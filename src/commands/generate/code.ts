import ncp from 'copy-paste'
import inquirer from 'inquirer'
import highlight from 'cli-highlight'
import { collectSpecialFileContents } from '../../utils/command_utils'
import { getConfig, getClovingConfig, getAllFiles } from '../../utils/config_utils'
import { parseMarkdownInstructions } from '../../utils/string_utils'
import ClovingGPT from '../../cloving_gpt'
import type { ClovingGPTOptions } from '../../utils/types'
import fs from 'fs'
import path from 'path'

const generateCodePrompt = (prompt: string | undefined, files: string[], contextFiles: Record<string, string>, previousCode?: string): string => {
  const specialFileContents = collectSpecialFileContents()
  const specialFiles = Object.keys(specialFileContents).map((file) => `### Contents of ${file}\n\n${JSON.stringify(specialFileContents[file], null, 2)}\n\n`).join('\n')
  const contextFileContents = Object.keys(contextFiles).map((file) => `### Contents of ${file}\n\n${contextFiles[file]}\n\n`).join('\n')

  let promptText = `### Description of App

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

  promptText += `### Example of a well-structured response

Here are the files that I would like to generate:

1. **src/commands/generate/shell.ts**

\`\`\`typescript
import inquirer from 'inquirer'
import highlight from 'cli-highlight'
import { execSync } from 'child_process'
import ncp from 'copy-paste'
import { extractMarkdown } from '../../utils/string_utils'
import { getConfig } from '../../utils/config_utils'
import ClovingGPT from '../../cloving_gpt'
import type { ClovingGPTOptions } from '../../utils/types'

const generateShellPrompt = (prompt: string | undefined): string => {
  const shell = execSync('echo $SHELL').toString().trim()
  const os = execSync('echo $OSTYPE').toString().trim()
  return \`Generate an executable \${shell} script that works on \${os}. Try to make it a single line if possible and as simple and straightforward as possible.

Do not add any commentary or context to the message other than the commit message itself.

An example of the output for this should look like the following:
\`\`\`

2. **src/commands/generate/code.ts**

\`\`\`typescript
import ncp from 'copy-paste'
import inquirer from 'inquirer'
import highlight from 'cli-highlight'
import { collectSpecialFileContents } from '../../utils/command_utils'
import { getConfig, getClovingConfig, getAllFiles } from '../../utils/config_utils'
import { parseMarkdownInstructions, extractMarkdown } from '../../utils/string_utils'
import ClovingGPT from '../../cloving_gpt'
import type { ClovingGPTOptions } from '../../utils/types'
import fs from 'fs'
import path from 'path'

const generateCodePrompt = (prompt: string | undefined, files: string[], contextFiles: Record<string, string>, previousCode?: string): string => {
  const specialFileContents = collectSpecialFileContents()
  const specialFiles = Object.keys(specialFileContents).map((file) => \`### Contents of \${file}\\n\\n\${JSON.stringify(specialFileContents[file], null, 2)}\\n\\n\`).join('\\n')
  const contextFileContents = Object.keys(contextFiles).map((file) => \`### Contents of \${file}\\n\\n\${contextFiles[file]}\\n\\n\`).join('\\n')

  return 'Here is a description of my app:'
}
\`\`\`

### Request

Generate code that does the following: ${prompt}

Do not use any data from the example response structure, only use the structure. Please generate the code and include filenames with paths to the code files mentioned and do not be lazy and ask me to keep the existing code or show things like previous code remains unchanged, always include existing code in the response.`

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
      try {
        console.log(highlight(lines.slice(1, -1).join('\n'), { language }))
      } catch (error) {
        // don't highlight if it fails
        console.log(lines.slice(1, -1).join('\n'))
      }
      console.log(lines.slice(-1)[0])
    } else {
      console.log(highlight(code, { language: 'markdown' }))
    }
  })
}

const extractFilesAndContent = (rawCodeCommand: string): [string[], Record<string, string>] => {
  const files: string[] = []
  const fileContents: Record<string, string> = {}

  const matches = rawCodeCommand.match(/(\*{2})([^\*]+)(\*{2})/g)
  if (!matches) return [files, fileContents]

  for (const match of matches) {
    const fileName = match.replace(/\*{2}/g, '').trim()
    const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\*\\*${escapedFileName}\\*\\*\\n\\n\\\`{3}([\\s\\S]+?)\\\`{3}`, 'g');
    const contentMatch = regex.exec(rawCodeCommand)
    if (contentMatch) {
      files.push(fileName)
      let content = contentMatch[1]

      // Remove the first word after the opening triple backticks
      content = content.split('\n').map((line, idx) => idx === 0 ? line.replace(/^\w+\s*/, '') : line).join('\n')

      fileContents[fileName] = content
    }
  }

  return [files, fileContents]
}

const handleUserAction = async (gpt: ClovingGPT, rawCodeCommand: string, prompt: string, allSrcFiles: string[], contextFiles: Record<string, string>): Promise<void> => {
  const [files, fileContents] = extractFilesAndContent(rawCodeCommand)

  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Revise', value: 'revise' },
        { name: 'Explain', value: 'explain' },
        { name: 'Save a Source Code File', value: 'save' },
        { name: 'Save All Source Code Files', value: 'saveAll' },
        { name: 'Copy Source Code to Clipboard', value: 'copySource' },
        { name: 'Copy Entire Response to Clipboard', value: 'copyAll' },
        { name: 'Done', value: 'done' },
      ],
    },
  ])

  switch (action) {
    case 'revise':
      const { newPrompt } = await inquirer.prompt<{ newPrompt: string }>([
        {
          type: 'input',
          name: 'newPrompt',
          message: 'How would you like to modify the output:',
        },
      ])
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
      let copyAnother = true
      while (copyAnother) {
        const { fileToCopy } = await inquirer.prompt<{ fileToCopy: string }>([
          {
            type: 'list',
            name: 'fileToCopy',
            message: 'Which file do you want to copy to the clipboard?',
            choices: files.map(file => ({ name: file, value: file })),
          },
        ])

        if (fileContents[fileToCopy]) {
          ncp.copy(fileContents[fileToCopy], () => {
            console.log(`${fileToCopy} copied to clipboard`)
          })
        } else {
          console.log('File content not found.')
        }

        const { copyMore } = await inquirer.prompt<{ copyMore: boolean }>([
          {
            type: 'confirm',
            name: 'copyMore',
            message: 'Do you want to copy another file?',
            default: true,
          },
        ])

        copyAnother = copyMore
      }
      break
    case 'copyAll':
      ncp.copy(rawCodeCommand, () => {
        console.log('Entire response copied to clipboard')
      })
      break
    case 'save':
      let saveAnother = true
      while (saveAnother) {
        const { fileToSave } = await inquirer.prompt<{ fileToSave: string }>([
          {
            type: 'list',
            name: 'fileToSave',
            message: 'Which file do you want to save?',
            choices: files.map(file => ({ name: file, value: file })),
          },
        ])

        if (fileContents[fileToSave]) {
          const filePath = path.resolve(fileToSave)

          fs.mkdirSync(path.dirname(filePath), { recursive: true })
          fs.writeFileSync(filePath, fileContents[fileToSave])

          console.log(`${fileToSave} has been saved.`)
        } else {
          console.log('File content not found.')
        }

        const { saveMore } = await inquirer.prompt<{ saveMore: boolean }>([
          {
            type: 'confirm',
            name: 'saveMore',
            message: 'Do you want to save another file?',
            default: true,
          },
        ])

        saveAnother = saveMore
      }
      break
    case 'saveAll':
      files.forEach(file => {
        if (fileContents[file]) {
          const filePath = path.resolve(file)

          fs.mkdirSync(path.dirname(filePath), { recursive: true })
          fs.writeFileSync(filePath, fileContents[file])

          console.log(`${file} has been saved.`)
        } else {
          console.log(`File content not found for ${file}.`)
        }
      })
      console.log('All files have been saved.')
      break
    case 'done':
      break
  }
}

const addFilesToContext = async (contextFiles: Record<string, string>, filePath: string): Promise<void> => {
  const stats = fs.statSync(filePath)

  if (stats.isDirectory()) {
    const files = fs.readdirSync(filePath)
    for (const file of files) {
      await addFilesToContext(contextFiles, path.join(filePath, file))
    }
  } else if (stats.isFile()) {
    const content = fs.readFileSync(filePath, 'utf-8')
    contextFiles[filePath] = content
  }
}

const code = async (options: ClovingGPTOptions) => {
  let { prompt, files } = options
  options.silent = getConfig(options).globalSilent || false
  const gpt = new ClovingGPT(options)
  const allSrcFiles = await getAllFiles(options, false)
  const contextFiles: Record<string, string> = {}

  try {
    if (files) {
      files.forEach(async file => {
        await addFilesToContext(contextFiles, file)
      })
    } else {
      let firstFile = true
      let includeMoreFiles = true

      while (includeMoreFiles) {
        const { includeMore } = await inquirer.prompt<{ includeMore: boolean }>([
          {
            type: 'confirm',
            name: 'includeMore',
            message: `Do you want to include any${firstFile ? '' : ' other'} files or directories as context for the prompt?`,
            default: false,
          },
        ])

        firstFile = false
        includeMoreFiles = includeMore

        if (includeMoreFiles) {
          const { contextFile } = await inquirer.prompt<{ contextFile: string }>([
            {
              type: 'input',
              name: 'contextFile',
              message: 'Enter the relative path of a file or directory you would like to include as context:',
            },
          ])

          if (contextFile) {
            const filePath = path.resolve(contextFile)
            if (fs.existsSync(filePath)) {
              await addFilesToContext(contextFiles, filePath)
              console.log(`Added ${filePath} to context.`)
            } else {
              console.log(`File or directory ${contextFile} does not exist.`)
            }
          }
        }
      }
    }

    if (!prompt) {
      const { userPrompt } = await inquirer.prompt<{ userPrompt: string }>([
        {
          type: 'input',
          name: 'userPrompt',
          message: 'What would you like the code to do:',
        },
      ])
      prompt = userPrompt
    }

    if (files && files.length > 0) {
      // Check if the files exist
      const nonExistentFiles = files.filter(file => !fs.existsSync(file))
      if (nonExistentFiles.length > 0) {
        throw new Error(`The following files do not exist: ${nonExistentFiles.join(', ')}`)
      }

      // Read the content of the provided files
      for (const file of files) {
        await addFilesToContext(contextFiles, file)
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
