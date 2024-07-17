import inquirer from 'inquirer'
import highlight from 'cli-highlight'
import { execFileSync } from 'child_process'
import { promptUser, collectSpecialFileContents, readFileContent } from '../../utils/command_utils'
import { getConfig, getClovingConfig, getAllFiles } from '../../utils/config_utils'
import { parseMarkdownInstructions } from '../../utils/string_utils'
import ClovingGPT from '../../cloving_gpt'
import type { ClovingGPTOptions } from '../../utils/types'
import fs from 'fs'
import path from 'path'

const generateCodePrompt = (prompt: string | undefined, files: string[], contextFiles: Record<string, string>): string => {
  const specialFileContents = collectSpecialFileContents()
  const specialFiles = Object.keys(specialFileContents).map((file) => `### Contents of ${file}\n\n${JSON.stringify(specialFileContents[file], null, 2)}\n\n`).join('\n')
  const contextFileContents = Object.keys(contextFiles).map((file) => `### Contents of ${file}\n\n${contextFiles[file]}\n\n`).join('\n')

  return `Here is a description of my app:

${JSON.stringify(getClovingConfig(), null, 2)}

${specialFiles}

${contextFileContents}

### Directory structure

${files.join('\n')}

### Request

I would like to generate code that does the following: ${prompt}

Please generate the code and include filenames with paths to the code files mentioned.`
}

const generateExplainCodePrompt = (prompt: string): string => {
  return `${prompt}
  
Please briefly explain how this code works.`
}

const code = async (options: ClovingGPTOptions) => {
  let { prompt, files } = options
  options.silent = getConfig(options).globalSilent || false
  const gpt = new ClovingGPT(options)
  const allSrcFiles = await getAllFiles(options, true)
  const contextFiles: Record<string, string> = {}

  try {
    if (!prompt) {
      prompt = await promptUser('What would you like to build: ')
    }

    let includeMoreFiles = true

    while (includeMoreFiles) {
      const contextFile = await promptUser('Relative path of an existing file you would like to include as context in the prompt [optional]: ')
      if (contextFile) {
        const filePath = path.resolve(contextFile)
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8')
          contextFiles[filePath] = content
        } else {
          console.log(`File ${contextFile} does not exist.`)
        }
      }

      const { includeMore } = await inquirer.prompt<{ includeMore: boolean }>([
        {
          type: 'confirm',
          name: 'includeMore',
          message: 'Do you want to include any other files?',
          default: false,
        },
      ])

      includeMoreFiles = includeMore
    }

    // Generate the prompt for commit message
    const codePrompt = generateCodePrompt(prompt, allSrcFiles, contextFiles)

    // Instantiate ClovingGPT and get the commit message
    const rawCodeCommand = await gpt.generateText({ prompt: codePrompt })

    parseMarkdownInstructions(rawCodeCommand).map(code => {
      if (code.trim().startsWith('```')) {
        const lines = code.split('\n')
        const language = code.match(/```(\w+)/)?.[1] || 'plaintext'
        console.log(lines[0])
        console.log(highlight(lines.slice(1, -1).join('\n'), { language }))
        console.log(lines.slice(-1)[0])
      } else {
        console.log(highlight(code, { language: 'markdown' }))
      }
    })

    // Inquirer prompt for further actions
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Revise', value: 'revise' },
          { name: 'Explain', value: 'explain' },
          { name: 'Copy to Clipboard', value: 'copy' },
          { name: 'Cancel', value: 'cancel' },
        ],
      },
    ])

    switch (action) {
      case 'revise':
        // Logic to revise the prompt (not implemented in this example)
        console.log('Revise option selected. Implement revision logic here.')
        break
      case 'explain':
        const explainPrompt = generateExplainCodePrompt(rawCodeCommand)
        const explainCodeCommand = await gpt.generateText({ prompt: explainPrompt })
        console.log(highlight(explainCodeCommand, { language: 'markdown' }))
        break
      case 'copy':
        execFileSync('pbcopy', { input: rawCodeCommand })
        console.log('Script copied to clipboard.')
        break
      case 'cancel':
        console.log('Operation cancelled.')
        break
    }
  } catch (error) {
    console.error('Could not generate shell script', error)
  }
}

export default code
