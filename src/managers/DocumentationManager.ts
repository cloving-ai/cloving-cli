import fs from 'fs'
import path from 'path'
import { select, confirm } from '@inquirer/prompts'
import colors from 'colors'

import ClovingGPT from '../cloving_gpt'
import { getConfig } from '../utils/config_utils'
import { addFileOrDirectoryToContext } from '../utils/prompt_utils'
import { applyAndSaveCurrentNewBlocks, extractCurrentNewBlocks } from '../utils/string_utils'
import type { ClovingGPTOptions, ChatMessage } from '../utils/types'

class DocumentationManager {
  private gpt: ClovingGPT
  private contextFiles: Record<string, string> = {}
  private chatHistory: ChatMessage[] = []

  constructor(private options: ClovingGPTOptions) {
    this.options.silent = getConfig(options).globalSilent || false
    this.gpt = new ClovingGPT(options)
  }

  public async generateDocumentation(): Promise<void> {
    try {
      await this.loadContextFiles()
      const prompt = this.generateDocumentationPrompt()
      const response = await this.gpt.generateText({ prompt, messages: this.chatHistory })

      console.log(colors.cyan('\nGenerated documentation:'))
      console.log(response)

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
