import { confirm } from '@inquirer/prompts'
import colors from 'colors'

import ClovingGPT from '../cloving_gpt'
import { getConfig } from '../utils/config_utils'
import { CODEGEN_INSTRUCTIONS } from '../utils/prompts'
import { applyAndSaveCurrentNewBlocks, extractCurrentNewBlocks } from '../utils/string_utils'
import { DOCS_INSTRUCTIONS } from '../utils/prompts'
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
    this.options.silent = getConfig(options).globalSilent || false
    options.stream = true
    this.gpt = new ClovingGPT(options)
  }

  /**
   * Generates documentation for the specified files.
   * @returns {Promise<void>}
   */
  public async generateDocumentation(): Promise<void> {
    try {
      this.isProcessing = true
      await this.checkForLatestVersion()
      await this.loadContextFiles()
      this.addUserPrompt(this.generatePrompt())

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
   * Generates the documentation prompt to be sent to the GPT model.
   * @returns {string} The generated documentation prompt.
   */
  private generatePrompt(): string {
    const contextFileContents = Object.entries(this.contextFiles)
      .map(([file, content]) => `### File: ${file}\n\n\`\`\`\n${content}\n\`\`\`\n`)
      .join('\n\n')

    return `${DOCS_INSTRUCTIONS}\n\n${CODEGEN_INSTRUCTIONS}\n\n${contextFileContents}\n\n${DOCS_INSTRUCTIONS}`
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
      if (currentNewBlocks.length > 0) {
        const shouldSave = await confirm({
          message: '\n\nDo you want to save the generated documentation?',
          default: true,
        })

        if (shouldSave) {
          await applyAndSaveCurrentNewBlocks(currentNewBlocks)
          console.log(colors.green('\nDocumentation has been saved to the respective files.'))
        }
      }
    }
  }
}

export default DocsManager
