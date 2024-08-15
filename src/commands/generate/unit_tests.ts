import { promises as fs } from 'fs'
import { execFileSync } from 'child_process'
import highlight from 'cli-highlight'
import { select, confirm } from '@inquirer/prompts'

import { getGitDiff } from '../../utils/git_utils'
import { getTestingDirectory, getAllFiles } from '../../utils/config_utils'
import {
  extractCurrentNewBlocks,
  applyAndSaveCurrentNewBlocks,
  extractMarkdown,
} from '../../utils/string_utils'
import ClovingGPT from '../../cloving_gpt'
import type { ClovingGPTOptions } from '../../utils/types'

const extractChangedFiles = (gitDiff: string): string[] => {
  const fileRegex = /diff --git a\/(.+?) b\/(.+?)\n/g
  const files = new Set<string>()
  let match

  while ((match = fileRegex.exec(gitDiff)) !== null) {
    files.add(match[1])
  }

  return Array.from(files)
}

const generatePrompt = (files: string[], srcFiles: string, testFiles: string, gitDiff?: string) => {
  const filesList = files.length > 0 ? files.join('\n') : 'No files provided'

  return `Enumerate all the files in the provided list${gitDiff ? ' and git diff' : ''} as well as the file names of anything that these files interact with.
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
}

const handleUserAction = async (analysis: string, autoSave: boolean = false): Promise<void> => {
  const blocks = extractCurrentNewBlocks(analysis)

  if (autoSave) {
    await applyAndSaveCurrentNewBlocks(blocks)
    console.log('All unit test files have been saved.')
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

        await applyAndSaveCurrentNewBlocks(blocks.filter((block) => block.filePath === fileToSave))

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

const unitTests = async (options: ClovingGPTOptions) => {
  const { files, save } = options
  const gpt = new ClovingGPT(options)

  const allSrcFiles = await getAllFiles(options, true)
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
    const prompt = generatePrompt(files, allSrcFiles.join('\n'), testFiles)
    contextFiles = await gpt.generateText({ prompt })
  } else {
    console.log(
      'Generating unit tests for the git diff between this branch and the default branch...',
    )
    console.log('Gathering a list of files related to the changes...')
    const gitDiff = await getGitDiff()
    const changedFiles = extractChangedFiles(gitDiff)
    const prompt = generatePrompt(changedFiles, allSrcFiles.join('\n'), testFiles, gitDiff)
    contextFiles = await gpt.generateText({ prompt })
  }

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

## Example Response Structure

Here are the unit tests for the provided list of files:

1. **tests/utils/model_utils.test.ts**

\`\`\`typescript
import { getModel } from '../../src/utils/model_utils'

describe('modelUtils', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test('getModel should return default model when CLOVING_MODEL is not set', () => {
    delete process.env.CLOVING_MODEL
    const result = getModel()
    expect(result).toBe('claude:claude-3-5-sonnet-20240620')
  })

  test('getModel should return CLOVING_MODEL when it is set', () => {
    process.env.CLOVING_MODEL = 'openai:gpt-4'
    const result = getModel()
    expect(result).toBe('openai:gpt-4')
  })
})
\`\`\`

## Context

${context.join('\n\n')}

## Prompt

Create unit tests for the List of Files. Always show filenames for the generated code.`

    // Get the model and analysis using ClovingGPT
    analysis = await gpt.generateText({ prompt: message })
  } else {
    const message = `Create unit tests for the Code Diff. Always show filenames for the generated code.

## Code Diff

${await getGitDiff()}

## Context

${context.join('\n\n')}

## Example Response Structure

Here are the unit tests for the code diff:

1. **tests/utils/model_utils.test.ts**

\`\`\`typescript
import { getModel } from '../../src/utils/model_utils'

describe('modelUtils', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test('getModel should return default model when CLOVING_MODEL is not set', () => {
    delete process.env.CLOVING_MODEL
    const result = getModel()
    expect(result).toBe('claude:claude-3-5-sonnet-20240620')
  })

  test('getModel should return CLOVING_MODEL when it is set', () => {
    process.env.CLOVING_MODEL = 'openai:gpt-4'
    const result = getModel()
    expect(result).toBe('openai:gpt-4')
  })
})
\`\`\`

## Prompt

Create unit tests for the Code Diff. Always show filenames for the generated code.`

    // Get the model and analysis using ClovingGPT
    analysis = await gpt.generateText({ prompt: message })
  }

  if (analysis) {
    console.log(highlight(analysis))
  } else {
    console.log('No unit tests generated.')
  }

  // Add the new user action handling
  await handleUserAction(analysis, save)
}

export default unitTests
