import ncp from 'copy-paste'
import { select, input, confirm } from '@inquirer/prompts'
import highlight from 'cli-highlight'
import fs from 'fs'
import path from 'path'

import { collectSpecialFileContents, addFileOrDirectoryToContext, getAllFilesInDirectory } from '../utils/command_utils'
import { getClovingConfig } from '../utils/config_utils'
import { parseMarkdownInstructions, extractFilesAndContent, saveGeneratedFiles } from '../utils/string_utils'
import ClovingGPT from '../cloving_gpt'
import type { ClovingGPTOptions } from '../utils/types'

class CodeManager {
  private contextFiles: Record<string, string> = {}

  constructor(
    private gpt: ClovingGPT,
    private options: ClovingGPTOptions,
    private allSrcFiles: string[]
  ) { }

  private generateCodePrompt(prompt: string | undefined, previousCode?: string): string {
    const specialFileContents = collectSpecialFileContents()
    const specialFiles = Object.keys(specialFileContents).map((file) => `### Contents of ${file}\n\n${JSON.stringify(specialFileContents[file], null, 2)}\n\n`).join('\n')
    const contextFileContents = Object.keys(this.contextFiles).map((file) => `### Contents of ${file}\n\n${this.contextFiles[file]}\n\n`).join('\n')

    let promptText = `### Request

Generate code that does the following: ${prompt}

### Description of App

${JSON.stringify(getClovingConfig(), null, 2)}

${specialFiles}

${contextFileContents}

### Directory structure

${this.allSrcFiles.join('\n')}

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

### Request

Generate code that does the following: ${prompt}

Do not use any data from the example response structure, only use the structure. Generate the code and include filenames with paths to the code files mentioned and do not be lazy and ask me to keep the existing code or show things like previous code remains unchanged, always include existing code in the response.`

    return promptText
  }

  private displayGeneratedCode(rawCodeCommand: string) {
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

  private async updateContextFiles(files: string[], fileContents: Record<string, string>): Promise<void> {
    for (const file of files) {
      if (fileContents[file]) {
        this.contextFiles[file] = fileContents[file]
      }
    }
  }

  private async handleUserAction(rawCodeCommand: string, prompt: string): Promise<void> {
    const [files, fileContents] = extractFilesAndContent(rawCodeCommand)

    if (this.options.save) {
      await saveGeneratedFiles(files, fileContents)
      await this.updateContextFiles(files, fileContents)
      return
    }

    const action = await select({
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
    })

    switch (action) {
      case 'revise':
        const newPrompt = await input({
          message: 'How would you like to modify the output:',
        })
        let includeMoreFiles = true
        while (includeMoreFiles) {
          const contextFile = await input({
            message: 'Enter the relative path of a file or directory you would like to include as context (or press enter to continue):',
          })

          if (contextFile) {
            this.contextFiles = await addFileOrDirectoryToContext(contextFile, this.contextFiles, this.options)
          } else {
            includeMoreFiles = false
          }
        }
        const newRawCodeCommand = await this.generateCode(newPrompt, rawCodeCommand)
        this.displayGeneratedCode(newRawCodeCommand)
        await this.handleUserAction(newRawCodeCommand, newPrompt)
        break
      case 'explain':
        const explainPrompt = this.generateExplainCodePrompt(rawCodeCommand)
        const explainCodeCommand = await this.gpt.generateText({ prompt: explainPrompt })
        console.log(highlight(explainCodeCommand, { language: 'markdown' }))
        break
      case 'copySource':
        let copyAnother = true
        while (copyAnother) {
          const fileToCopy = await select({
            message: 'Which file do you want to copy to the clipboard?',
            choices: files.map(file => ({ name: file, value: file })),
          })

          if (fileContents[fileToCopy]) {
            ncp.copy(fileContents[fileToCopy], () => {
              console.log(`${fileToCopy} copied to clipboard`)
            })
          } else {
            console.log('File content not found.')
          }

          const copyMore = await confirm({
            message: 'Do you want to copy another file?',
            default: true,
          })

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
          const fileToSave = await select({
            message: 'Which file do you want to save?',
            choices: files.map(file => ({ name: file, value: file })),
          })

          if (fileContents[fileToSave]) {
            const filePath = path.resolve(fileToSave)

            await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
            await fs.promises.writeFile(filePath, fileContents[fileToSave])

            console.log(`${fileToSave} has been saved.`)
            await this.updateContextFiles([fileToSave], fileContents)
          } else {
            console.log('File content not found.')
          }

          const saveMore = await confirm({
            message: 'Do you want to save another file?',
            default: true,
          })

          saveAnother = saveMore
        }
        break
      case 'saveAll':
        await saveGeneratedFiles(files, fileContents)
        await this.updateContextFiles(files, fileContents)
        console.log('All files have been saved.')
        break
      case 'done':
        break
    }
  }

  private generateExplainCodePrompt(prompt: string): string {
    return `${prompt}

## Task

Please briefly explain how the code works in this.`
  }

  public async generateCode(prompt: string, previousCode?: string): Promise<string> {
    const codePrompt = this.generateCodePrompt(prompt, previousCode)
    return await this.gpt.generateText({ prompt: codePrompt })
  }

  public async processCode(prompt: string): Promise<void> {
    try {
      if (this.options.files) {
        let expandedFiles: string[] = []
        for (const file of this.options.files) {
          const filePath = path.resolve(file)
          if (await fs.promises.stat(filePath).then(stat => stat.isDirectory()).catch(() => false)) {
            const dirFiles = await getAllFilesInDirectory(filePath)
            expandedFiles = expandedFiles.concat(dirFiles.map(f => path.relative(process.cwd(), f)))
          } else {
            expandedFiles.push(path.relative(process.cwd(), filePath))
          }
        }
        this.options.files = expandedFiles

        for (const file of this.options.files) {
          const filePath = path.resolve(file)
          if (await fs.promises.stat(filePath).then(stat => stat.isFile()).catch(() => false)) {
            const content = await fs.promises.readFile(filePath, 'utf-8')
            this.contextFiles[file] = content
          }
        }
      } else {
        let includeMoreFiles = true

        while (includeMoreFiles) {
          const contextFile = await input({
            message: `Enter the relative path of a file or directory you would like to include as context (or press enter to continue):`,
          })

          if (contextFile) {
            this.contextFiles = await addFileOrDirectoryToContext(contextFile, this.contextFiles, this.options)
          } else {
            includeMoreFiles = false
          }
        }
      }

      if (!prompt) {
        const userPrompt = await input({
          message: 'What would you like the code to do:',
        })
        prompt = userPrompt
      }

      let rawCodeCommand = await this.generateCode(prompt)
      this.displayGeneratedCode(rawCodeCommand)

      if (this.options.save) {
        const [files, fileContents] = extractFilesAndContent(rawCodeCommand)
        await saveGeneratedFiles(files, fileContents)
        await this.updateContextFiles(files, fileContents)
      } else {
        await this.handleUserAction(rawCodeCommand, prompt)
      }

      if (this.options.interactive) {
        let continueInteractive = true
        while (continueInteractive) {
          const newPrompt = await input({
            message: 'Revise the code (or press enter to finish):',
          })

          if (newPrompt.trim() === '') {
            continueInteractive = false
          } else {
            let includeMoreFiles = true
            while (includeMoreFiles) {
              const contextFile = await input({
                message: 'Enter the relative path of a file or directory you would like to include as context (or press enter to continue):',
              })

              if (contextFile) {
                this.contextFiles = await addFileOrDirectoryToContext(contextFile, this.contextFiles, this.options)
              } else {
                includeMoreFiles = false
              }
            }
            rawCodeCommand = await this.generateCode(newPrompt, rawCodeCommand)
            this.displayGeneratedCode(rawCodeCommand)

            if (this.options.save || this.options.interactive) {
              const [files, fileContents] = extractFilesAndContent(rawCodeCommand)
              await saveGeneratedFiles(files, fileContents)
              await this.updateContextFiles(files, fileContents)
            } else {
              await this.handleUserAction(rawCodeCommand, newPrompt)
            }
          }
        }
      }
    } catch (error) {
      console.error('Could not generate code', error)
    }
  }
}

export default CodeManager