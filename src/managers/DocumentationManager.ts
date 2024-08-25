import { confirm } from '@inquirer/prompts'
import colors from 'colors'
import highlight from 'cli-highlight'

import ClovingGPT from '../cloving_gpt'
import { getConfig } from '../utils/config_utils'
import { addFileOrDirectoryToContext } from '../utils/prompt_utils'
import { CODEGEN_INSTRUCTIONS } from '../utils/prompts'
import {
  applyAndSaveCurrentNewBlocks,
  extractCurrentNewBlocks,
  parseMarkdownInstructions,
} from '../utils/string_utils'
import type { ClovingGPTOptions, ChatMessage } from '../utils/types'

/**
 * Manages the generation of documentation for specified files.
 */
class DocumentationManager {
  private gpt: ClovingGPT
  private contextFiles: Record<string, string> = {}
  private chatHistory: ChatMessage[] = []

  /**
   * Creates a new DocumentationManager instance.
   * @param {ClovingGPTOptions} options - Configuration options for the DocumentationManager.
   */
  constructor(private options: ClovingGPTOptions) {
    this.options.silent = getConfig(options).globalSilent || false
    this.gpt = new ClovingGPT(options)
  }

  /**
   * Generates documentation for the specified files.
   * @returns {Promise<void>}
   */
  public async generateDocumentation(): Promise<void> {
    try {
      await this.loadContextFiles()
      if (this.chatHistory.length === 0) {
        this.chatHistory.push({ role: 'user', content: CODEGEN_INSTRUCTIONS })
        this.chatHistory.push({ role: 'assistant', content: 'What would you like to do?' })
      }
      const prompt = this.generateDocumentationPrompt()
      this.chatHistory.push({ role: 'user', content: prompt })

      const response = await this.gpt.generateText({ prompt, messages: this.chatHistory })

      this.displayGeneratedDocumentation(response)

      const currentNewBlocks = extractCurrentNewBlocks(response)
      if (currentNewBlocks.length > 0) {
        const shouldSave = await confirm({
          message: 'Do you want to save the generated documentation?',
          default: true,
        })

        if (shouldSave) {
          await applyAndSaveCurrentNewBlocks(currentNewBlocks)
          console.log(colors.green('\nDocumentation has been saved to the respective files.'))
        }
      }
    } catch (error) {
      console.error(colors.red('Error generating documentation:'), error)
    }
  }

  /**
   * Displays the generated documentation in the console with syntax highlighting.
   * @param {string} rawDocumentationResponse - The raw documentation response from the GPT model.
   */
  private displayGeneratedDocumentation(rawDocumentationResponse: string) {
    parseMarkdownInstructions(rawDocumentationResponse).map((code) => {
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

  /**
   * Loads the context files specified in the options.
   * @returns {Promise<void>}
   */
  private async loadContextFiles(): Promise<void> {
    if (this.options.files) {
      for (const file of this.options.files) {
        this.contextFiles = await addFileOrDirectoryToContext(file, this.contextFiles, this.options)
      }
    } else {
      console.log(colors.yellow('No files specified. Please provide files using the -f option.'))
      process.exit(1)
    }
  }

  /**
   * Generates the documentation prompt to be sent to the GPT model.
   * @returns {string} The generated documentation prompt.
   */
  private generateDocumentationPrompt(): string {
    const contextFileContents = Object.entries(this.contextFiles)
      .map(([file, content]) => `### File: ${file}\n\n\`\`\`\n${content}\n\`\`\`\n`)
      .join('\n\n')

    return `Please generate documentation for the following files. Add or update documentation comments for functions, classes, and modules as appropriate. Use the standard documentation format for the respective language (e.g., JSDoc for JavaScript/TypeScript, docstrings for Python, etc.).

${contextFileContents}

Please provide the updated files with added documentation using the CURRENT/NEW block format. Only include the parts of the files that have changed.`
  }
}

export default DocumentationManager
