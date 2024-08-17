import { select, input, confirm } from '@inquirer/prompts'
import { AxiosError } from 'axios'
import highlight from 'cli-highlight'

import ClovingGPT from '../cloving_gpt'

import { generateCodegenPrompt, addFileOrDirectoryToContext } from '../utils/prompt_utils'
import {
  checkBlocksApplicability,
  parseMarkdownInstructions,
  extractCurrentNewBlocks,
  applyAndSaveCurrentNewBlocks,
} from '../utils/string_utils'

import type { ClovingGPTOptions, ChatMessage } from '../utils/types'

class CodeManager {
  private gpt: ClovingGPT
  private contextFiles: Record<string, string> = {}
  private chatHistory: ChatMessage[] = []

  constructor(private options: ClovingGPTOptions) {
    this.gpt = new ClovingGPT(options)
  }

  public async initialize(): Promise<void> {
    try {
      if (this.options.files) {
        for (const file of this.options.files) {
          this.contextFiles = await addFileOrDirectoryToContext(
            file,
            this.contextFiles,
            this.options,
          )
        }
      } else {
        let includeMoreFiles = true

        while (includeMoreFiles) {
          const contextFile = await input({
            message: `Enter the relative path of a file or directory you would like to include as context (or press enter to continue):`,
          })

          if (contextFile) {
            this.contextFiles = await addFileOrDirectoryToContext(
              contextFile,
              this.contextFiles,
              this.options,
            )
          } else {
            includeMoreFiles = false
          }
        }
      }

      if (!this.options.prompt) {
        const userPrompt = await input({
          message: 'What would you like the code to do:',
        })
        this.options.prompt = userPrompt
      }

      let response = await this.generateCode(this.options.prompt)

      const currentNewBlocks = extractCurrentNewBlocks(response)
      const [canApply, summary] = await checkBlocksApplicability(currentNewBlocks)
      if (!canApply) {
        console.log(
          'The generated code could not be automatically applied. It will try again asking for more details.',
        )
        console.log(`Some of the provided code blocks could not be applied,
please match the existing code with a few more lines of context and make sure it is a character for character exact match.

${summary}`)
        response = await this.generateCode(this.options.prompt)
        this.displayGeneratedCode(response)
      }

      this.displayGeneratedCode(response)

      if (this.options.save) {
        const currentNewBlocks = extractCurrentNewBlocks(response)
        await applyAndSaveCurrentNewBlocks(currentNewBlocks)
      } else {
        await this.handleUserAction(response, this.options.prompt)
      }
    } catch (err) {
      const error = err as AxiosError
      console.error('Could not generate code', error.message)
    }
  }

  public async generateCode(userPrompt: string): Promise<string> {
    if (this.chatHistory.length === 0) {
      const systemPrompt = generateCodegenPrompt(this.contextFiles)
      this.chatHistory.push({ role: 'user', content: systemPrompt })
      this.chatHistory.push({ role: 'assistant', content: 'What would you like to do?' })
    }
    this.chatHistory.push({ role: 'user', content: userPrompt })
    return await this.gpt.generateText({ prompt: userPrompt, messages: this.chatHistory })
  }

  private displayGeneratedCode(rawCodeCommand: string) {
    parseMarkdownInstructions(rawCodeCommand).map((code) => {
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

  private async handleUserAction(response: string, prompt: string): Promise<void> {
    const currentNewBlocks = extractCurrentNewBlocks(response)
    const files = Array.from(new Set(currentNewBlocks.map((block) => block.filePath)))

    if (this.options.save) {
      await applyAndSaveCurrentNewBlocks(currentNewBlocks)
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
            message:
              'Enter the relative path of a file or directory you would like to include as context (or press enter to continue):',
          })

          if (contextFile) {
            this.contextFiles = await addFileOrDirectoryToContext(
              contextFile,
              this.contextFiles,
              this.options,
            )
          } else {
            includeMoreFiles = false
          }
        }
        const newResponse = await this.generateCode(newPrompt)
        this.displayGeneratedCode(newResponse)
        await this.handleUserAction(newResponse, newPrompt)
        break
      case 'explain':
        const explainPrompt = this.generateExplainCodePrompt(response)
        this.chatHistory.push({ role: 'user', content: explainPrompt })
        const explainCodeCommand = await this.gpt.generateText({
          prompt: explainPrompt,
          messages: this.chatHistory,
        })
        console.log(highlight(explainCodeCommand, { language: 'markdown' }))
        break
      case 'save':
        let saveAnother = true
        while (saveAnother) {
          const fileToSave = await select({
            message: 'Which file do you want to save?',
            choices: files.map((file) => ({ name: file, value: file })),
          })

          await applyAndSaveCurrentNewBlocks(
            currentNewBlocks.filter((block) => block.filePath === fileToSave),
          )

          const saveMore = await confirm({
            message: 'Do you want to save another file?',
            default: true,
          })

          saveAnother = saveMore
        }
        break
      case 'saveAll':
        await applyAndSaveCurrentNewBlocks(currentNewBlocks)
        console.log('All files have been saved.')
        break
      case 'done':
        break
    }
  }

  private generateExplainCodePrompt(prompt: string): string {
    return `${prompt}

# Task

Please briefly explain how the code works in this.`
  }
}

export default CodeManager
