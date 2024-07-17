import ncp from 'copy-paste'
import inquirer from 'inquirer'
import highlight from 'cli-highlight'
import { promptUser, collectSpecialFileContents } from '../../utils/command_utils'
import { getConfig, getClovingConfig, getAllFiles } from '../../utils/config_utils'
import { parseMarkdownInstructions, extractMarkdown } from '../../utils/string_utils'
import ClovingGPT from '../../cloving_gpt'
import type { ClovingGPTOptions } from '../../utils/types'
import fs from 'fs'
import path from 'path'

const generateCodePrompt = (prompt: string | undefined, files: string[], contextFiles: Record<string, string>, previousCode?: string): string => {
  const specialFileContents = collectSpecialFileContents()
  const specialFiles = Object.keys(specialFileContents).map((file) => `### Contents of ${file}\n\n${JSON.stringify(specialFileContents[file], null, 2)}\n\n`).join('\n')
  const contextFileContents = Object.keys(contextFiles).map((file) => `### Contents of ${file}\n\n${contextFiles[file]}\n\n`).join('\n')

  let promptText = `Here is a description of my app:

${JSON.stringify(getClovingConfig(), null, 2)}

${specialFiles}

${contextFileContents}

### Directory structure

${files.join('\n')}

`

  if (previousCode) {
    promptText += `### Previously generated code

${previousCode}

`
  }

  promptText += `### Request

I would like to generate code that does the following: ${prompt}

Please generate the code and include filenames with paths to the code files mentioned and do not be lazy and ask me to keep the existing code or show things like previous code remains unchanged, always include existing code in the response.`

  return promptText
}

const generateExplainCodePrompt = (prompt: string): string => {
  return `${prompt}
  
Please briefly explain how this code works.`
}

const generateCode = async (gpt: ClovingGPT, prompt: string, allSrcFiles: string[], contextFiles: Record<string, string>, previousCode?: string): Promise<string> => {
  const codePrompt = generateCodePrompt(prompt, allSrcFiles, contextFiles, previousCode)
  return await gpt.generateText({ prompt: codePrompt })
}

const displayGeneratedCode = (rawCodeCommand: string) => {
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
}

const handleUserAction = async (gpt: ClovingGPT, rawCodeCommand: string, prompt: string, allSrcFiles: string[], contextFiles: Record<string, string>): Promise<void> => {
  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Revise', value: 'revise' },
        { name: 'Explain', value: 'explain' },
        { name: 'Copy Source Code to Clipboard', value: 'copySource' },
        { name: 'Copy Entire Response to Clipboard', value: 'copyAll' },
        { name: 'Cancel', value: 'cancel' },
      ],
    },
  ])

  switch (action) {
    case 'revise':
      const newPrompt = await promptUser('Enter your revised prompt: ')
      const newRawCodeCommand = await generateCode(gpt, newPrompt, allSrcFiles, contextFiles, rawCodeCommand)
      displayGeneratedCode(newRawCodeCommand)
      await handleUserAction(gpt, newRawCodeCommand, newPrompt, allSrcFiles, contextFiles)
      break
    case 'explain':
      const explainPrompt = generateExplainCodePrompt(rawCodeCommand)
      const explainCodeCommand = await gpt.generateText({ prompt: explainPrompt })
      console.log(highlight(explainCodeCommand, { language: 'markdown' }))
      break
    case 'copySource':
      const sourceCode = extractMarkdown(rawCodeCommand)
      ncp.copy(sourceCode, () => {
        console.log('Source code to clipboard')
      })
      break
    case 'copyAll':
      ncp.copy(rawCodeCommand, () => {
        console.log('Entire response copied to clipboard')
      })
      break
    case 'cancel':
      console.log('Operation cancelled.')
      break
  }
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

    if (files && files.length > 0) {
      // Check if the files exist
      const nonExistentFiles = files.filter(file => !fs.existsSync(file))
      if (nonExistentFiles.length > 0) {
        throw new Error(`The following files do not exist: ${nonExistentFiles.join(', ')}`)
      }

      // Read the content of the provided files
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')
        contextFiles[file] = content
      }
    } else {
      // Prompt for additional context files if no files were passed in options
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
    }

    const rawCodeCommand = await generateCode(gpt, prompt, allSrcFiles, contextFiles)
    displayGeneratedCode(rawCodeCommand)
    await handleUserAction(gpt, rawCodeCommand, prompt, allSrcFiles, contextFiles)
  } catch (error) {
    console.error('Could not generate code', error)
  }
}

export default code
