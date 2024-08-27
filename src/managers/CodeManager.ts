import { select, input, confirm } from '@inquirer/prompts'
import { AxiosError } from 'axios'
import highlight from 'cli-highlight'
import colors from 'colors'

import ClovingGPT from '../cloving_gpt'

import { getConfig } from '../utils/config_utils'
import { generateCodegenPrompt, addFileOrDirectoryToContext } from '../utils/prompt_utils'
import {
  checkBlocksApplicability,
  extractCurrentNewBlocks,
  applyAndSaveCurrentNewBlocks,
} from '../utils/string_utils'
import { CODEGEN_COULDNT_APPLY } from '../utils/prompts'
import type { ClovingGPTOptions } from '../utils/types'
import StreamManager from './StreamManager'

class CodeManager extends StreamManager {
  constructor(options: ClovingGPTOptions) {
    super(options)
    options.silent = getConfig(options).globalSilent || false
    options.stream = true
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
            message: `Enter the relative path of a file or directory you would like to include as context (or press enter to continue): `,
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

      await this.generateCode(this.options.prompt)
    } catch (err) {
      const error = err as AxiosError
      console.error('Could not generate code', error.message)
    }
  }

  public async generateCode(userPrompt: string): Promise<void> {
    await this.checkForLatestVersion()
    await this.loadContextFiles()

    if (this.chatHistory.length === 0) {
      this.addUserPrompt(generateCodegenPrompt(this.contextFiles))
      this.addAssistantResponse('What would you like to do?')
    }

    this.addUserPrompt(userPrompt)

    try {
      const responseStream = await this.gpt.streamText({
        prompt: userPrompt,
        messages: this.chatHistory,
      })

      this.handleResponseStream(responseStream)
    } catch (err) {
      const error = err as AxiosError
      console.error('Error streaming response:', error.message)
    }
  }

  private async handleUserAction(response: string): Promise<void> {
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
        await this.generateCode(newPrompt)
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
        console.log(colors.green('\nAll files have been saved.'))
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

  /**
   * Finalizes the response processing.
   * This method should be overridden to provide specific finalization behavior.
   * @protected
   */
  protected async finalizeResponse(): Promise<void> {
    console.log('\n')
    this.fullResponse += `${this.responseString}\n\n`
    this.addAssistantResponse(this.responseString)
    this.isProcessing = false

    if (!this.responseString.includes('======= DONE =======')) {
      console.log(colors.yellow('Checking if there is more...'))
      this.addUserPrompt(
        "If there is more, continue, otherwise print the string '======= DONE ======='.",
      )
      const responseStream = await this.gpt.streamText({
        prompt: this.prompt,
        messages: this.chatHistory,
      })

      this.handleResponseStream(responseStream)
      return
    }

    if (this.fullResponse !== '') {
      const currentNewBlocks = extractCurrentNewBlocks(this.fullResponse)
      const [canApply, summary] = await checkBlocksApplicability(currentNewBlocks)
      if (!canApply) {
        if (this.retryCount < this.maxRetries) {
          console.log(
            `\n\n${summary}\n\n${colors.yellow.bold('WARNING')} Some of the provided code blocks could not be automatically applied. Retrying (Attempt ${this.retryCount + 1}/${this.maxRetries})...\n`,
          )

          this.retryCount++
          this.generateCode(`${CODEGEN_COULDNT_APPLY}\n\n${summary}`)

          return
        } else {
          console.log(
            `\n\n${colors.red.bold('ERROR')} Failed to generate a diff that could be cleanly applied after ${this.maxRetries} attempts. Please review the changes manually and try again.\n`,
          )
          this.retryCount = 0 // Reset the retry count for future attempts
        }
      } else {
        this.retryCount = 0 // Reset the retry count on successful application
      }
    }
    const extraResponse = this.fullResponse
    this.fullResponse = '' // Reset the full response

    this.handleUserAction(extraResponse)
  }
}

export default CodeManager
