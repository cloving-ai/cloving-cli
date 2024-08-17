import { promises as fs } from 'fs'
import { execFileSync } from 'child_process'
import highlight from 'cli-highlight'
import { select, confirm } from '@inquirer/prompts'

import { getGitDiff } from '../utils/git_utils'
import { CODEGEN_INSTRUCTIONS } from '../utils/prompt_utils'
import { getTestingDirectory, getAllFiles } from '../utils/config_utils'
import {
  extractCurrentNewBlocks,
  applyAndSaveCurrentNewBlocks,
  extractMarkdown,
} from '../utils/string_utils'
import ClovingGPT from '../cloving_gpt'
import type { ClovingGPTOptions, ChatMessage } from '../utils/types'

class UnitTestManager {
  private gpt: ClovingGPT
  private chatHistory: ChatMessage[] = []

  constructor(private options: ClovingGPTOptions) {
    this.gpt = new ClovingGPT(options)
  }

  private extractChangedFiles(gitDiff: string): string[] {
    const fileRegex = /diff --git a\/(.+?) b\/(.+?)\n/g
    const files = new Set<string>()
    let match

    while ((match = fileRegex.exec(gitDiff)) !== null) {
      files.add(match[1])
    }

    return Array.from(files)
  }

  private generateUnitTestPrompt(
    files: string[],
    srcFiles: string,
    testFiles: string,
    gitDiff?: string,
  ): string {
    if (this.chatHistory.length === 0) {
      const systemPrompt = `### Example of a well-structured response

# Unit Test Generation

## Files Overview

These are the files that are relevant for generating unit tests:

1. **app/models/foo.rb**
2. **app/views/baz/bar.html.erb**

## Relevant Test Files

1. **test/models/foo_test.rb**
2. **test/controllers/baz_controller_test.rb**

## Task

Generate unit tests for the files listed above. Always show filenames for the generated code.`

      this.chatHistory.push({ role: 'user', content: systemPrompt })
      this.chatHistory.push({ role: 'assistant', content: 'What would you like to do?' })
    }

    const filesList = files.length > 0 ? files.join('\n') : 'No files provided'
    const prompt = `Enumerate all the files in the provided list${gitDiff ? ' and git diff' : ''} as well as the file names of anything that these files interact with.
Also, list any test files that might be relevant to these files.

### List of Code Files

${filesList}

### List of All Source Files

${srcFiles}

### List of all test files

${testFiles}

${gitDiff ? '### Git Diff Content' : ''}

${gitDiff || ''}

## Example Output

Here are the files that are relevant:

\`\`\`plaintext
## files

app/models/foo.rb
app/views/baz/bar.html.erb

## relevant test files

test/models/foo_test.rb
test/controllers/baz_controller_test.rb
\`\`\`

### Prompt

Enumerate all the files in the provided list${gitDiff ? ' and git diff' : ''} as well as the file names of anything that these files interact with.
Also, list any test files that might be relevant to these files.`
    this.chatHistory.push({ role: 'user', content: prompt })
    return prompt
  }

  private async handleUserAction(analysis: string, autoSave: boolean = false): Promise<void> {
    const blocks = extractCurrentNewBlocks(analysis)

    if (autoSave) {
      await applyAndSaveCurrentNewBlocks(blocks)
      return
    }

    const files = Array.from(new Set(blocks.map((block) => block.filePath)))

    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: 'Save a Unit Test File', value: 'save' },
        { name: 'Save All Unit Test Files', value: 'saveAll' },
        { name: 'Copy Entire Response to Clipboard', value: 'copyAll' },
        { name: 'Done', value: 'done' },
      ],
    })

    switch (action) {
      case 'save':
        let saveAnother = true
        while (saveAnother) {
          const fileToSave = await select({
            message: 'Which unit test file do you want to save?',
            choices: files.map((file) => ({ name: file, value: file })),
          })

          await applyAndSaveCurrentNewBlocks(
            blocks.filter((block) => block.filePath === fileToSave),
          )

          saveAnother = await confirm({
            message: 'Do you want to save another file?',
            default: false,
          })
        }
        break
      case 'saveAll':
        await applyAndSaveCurrentNewBlocks(blocks)
        console.log('All unit test files have been saved.')
        break
      case 'copyAll':
        process.nextTick(() => {
          require('copy-paste').copy(analysis, () => {
            console.log('Entire response copied to clipboard')
          })
        })
        break
      case 'done':
        break
    }
  }

  public async generateUnitTests() {
    const { files, save } = this.options

    const allSrcFiles = await getAllFiles(this.options, true)
    const testingDirectory = getTestingDirectory()

    if (allSrcFiles.length === 0 || !testingDirectory) {
      console.error(
        'Could not find any source files to generate unit tests. Please run: cloving init. Then try again.',
      )
      process.exit(1)
    }

    const testFiles = execFileSync('find', [testingDirectory, '-type', 'f']).toString().trim()
    let contextFiles: string

    if (files) {
      console.log('Generating unit tests for the provided files...')
      console.log('Gathering a list of files related to the changes...')
      const prompt = this.generateUnitTestPrompt(files, allSrcFiles.join('\n'), testFiles)
      contextFiles = await this.gpt.generateText({ prompt, messages: this.chatHistory })
    } else {
      console.log(
        'Generating unit tests for the git diff between this branch and the default branch...',
      )
      console.log('Gathering a list of files related to the changes...')
      const gitDiff = await getGitDiff()
      const changedFiles = this.extractChangedFiles(gitDiff)
      const prompt = this.generateUnitTestPrompt(
        changedFiles,
        allSrcFiles.join('\n'),
        testFiles,
        gitDiff,
      )
      contextFiles = await this.gpt.generateText({ prompt, messages: this.chatHistory })
    }

    this.chatHistory.push({ role: 'assistant', content: contextFiles })
    contextFiles = extractMarkdown(contextFiles)

    console.log(contextFiles)
    console.log('\nBuilding the tests for these files...')

    // Initialize variables
    const lines: string[] = []
    const context: string[] = []

    // Read each line of the context files
    contextFiles.split('\n').forEach((line) => {
      if (line.trim()) {
        lines.push(line.trim())
      }
    })

    for (const codeFile of lines) {
      if (
        await fs
          .stat(codeFile)
          .then((stat) => stat.isFile())
          .catch(() => false)
      ) {
        const fileContents = await fs.readFile(codeFile, 'utf-8')
        context.push(
          `### Contents of **${codeFile}\n\n${fileContents
            .split('\n')
            .map((line) => `    ${line}`)
            .join('\n')}**\n\n`,
        )
      }
    }

    // Generate the message for unit test creation
    let analysis = ''

    if ((files || []).length > 0) {
      const message = `Create unit tests for the List of Files. Always show filenames for the generated code.

## List of Files
${(files || []).join('\n')}

${CODEGEN_INSTRUCTIONS}

## Context

${context.join('\n\n')}

## Prompt

Create unit tests for the List of Files. Always show filenames for the generated code.`

      // Get the model and analysis using ClovingGPT
      this.chatHistory.push({ role: 'user', content: message })
      analysis = await this.gpt.generateText({ prompt: message, messages: this.chatHistory })
    } else {
      const message = `Create unit tests for the Code Diff. Always show filenames for the generated code.

## Code Diff

${await getGitDiff()}

## Context

${context.join('\n\n')}

${CODEGEN_INSTRUCTIONS}

## Prompt

Create unit tests for the Code Diff. Always show filenames for the generated code.`

      // Get the model and analysis using ClovingGPT
      this.chatHistory.push({ role: 'user', content: message })
      analysis = await this.gpt.generateText({ prompt: message, messages: this.chatHistory })
    }

    if (analysis) {
      console.log(highlight(analysis))
    } else {
      console.log('No unit tests generated.')
    }

    // Add the new user action handling
    await this.handleUserAction(analysis, save)
  }
}

export default UnitTestManager
