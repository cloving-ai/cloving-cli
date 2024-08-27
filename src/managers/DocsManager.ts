import { confirm } from '@inquirer/prompts'
import colors from 'colors'

import ClovingGPT from '../cloving_gpt'
import { getConfig } from '../utils/config_utils'
import { CODEGEN_COULDNT_APPLY } from '../utils/prompts'
import { generateDocsPrompt } from '../utils/prompt_utils'
import {
  applyAndSaveCurrentNewBlocks,
  extractCurrentNewBlocks,
  checkBlocksApplicability,
} from '../utils/string_utils'
import type { ClovingGPTOptions } from '../utils/types'
import StreamManager from './StreamManager'

/**
 * Manages the generation of documentation for specified files.
 */
class DocsManager extends StreamManager {
  /**
   * Creates a new DocumentationManager instance.
   * @param {ClovingGPTOptions} options - Configuration options for the DocumentationManager.
   */
  constructor(options: ClovingGPTOptions) {
    super(options)
    options.silent = getConfig(options).globalSilent || false
    options.stream = true
    this.gpt = new ClovingGPT(options)
  }

  /**
   * Generates documentation for the specified files.
   * @returns {Promise<void>}
   */
  public async generateDocs(extraPrompt?: string): Promise<void> {
    try {
      this.isProcessing = true
      if (this.retryCount === 0) {
        await this.checkForLatestVersion()
      }
      await this.loadContextFiles()
      this.addUserPrompt(`${generateDocsPrompt(this.contextFiles)}\n\n${extraPrompt || ''}`)

      const responseStream = await this.gpt.streamText({
        prompt: this.prompt,
        messages: this.chatHistory,
      })

      this.handleResponseStream(responseStream)
    } catch (error) {
      console.error(colors.red('Error generating documentation:'), error)
    }
  }

  /**
   * Finalizes the response processing.
   * This method should be overridden to provide specific finalization behavior.
   * @protected
   */
  protected async finalizeResponse(): Promise<void> {
    this.addAssistantResponse(this.responseString)
    this.isProcessing = false

    if (this.responseString !== '') {
      const currentNewBlocks = extractCurrentNewBlocks(this.responseString)
      const [canApply, summary] = await checkBlocksApplicability(currentNewBlocks)
      if (canApply && currentNewBlocks.length > 0) {
        const shouldSave = await confirm({
          message: '\n\nDo you want to save the generated documentation?',
          default: true,
        })

        if (shouldSave) {
          await applyAndSaveCurrentNewBlocks(currentNewBlocks)
          console.log(colors.green('\nDocumentation has been saved to the respective files.'))
        }
      } else {
        if (this.retryCount < this.maxRetries) {
          console.log(
            `\n\n${summary}\n\n${colors.yellow.bold('WARNING')} Some of the provided code blocks could not be automatically applied. Retrying (Attempt ${this.retryCount + 1}/${this.maxRetries})...\n`,
          )

          this.retryCount++
          this.generateDocs(`\n\n${CODEGEN_COULDNT_APPLY}\n\n${summary}`)

          return
        } else {
          console.log(
            `\n\n${colors.red.bold('ERROR')} Failed to generate a diff that could be cleanly applied after ${this.maxRetries} attempts. Please review the changes manually and try again.\n`,
          )
          this.retryCount = 0 // Reset the retry count for future attempts
        }
      }
    }
  }
}

export default DocsManager
