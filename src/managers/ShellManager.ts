import highlight from 'cli-highlight'
import ncp from 'copy-paste'
import { execSync } from 'child_process'
import { select, input } from '@inquirer/prompts'

import ClovingGPT from '../cloving_gpt'
import { generateShellPrompt } from '../utils/prompt_utils'
import { extractMarkdown } from '../utils/string_utils'
import { getConfig } from '../utils/config_utils'

import type { ClovingGPTOptions, ChatMessage } from '../utils/types'

/**
 * ShellManager class for handling shell script generation and execution.
 */
class ShellManager {
  private gpt: ClovingGPT
  private chatHistory: ChatMessage[] = []

  /**
   * Creates an instance of ShellManager.
   * @param {ClovingGPTOptions} options - The options for ClovingGPT.
   */
  constructor(private options: ClovingGPTOptions) {
    options.silent = getConfig(options).globalSilent || false
    this.gpt = new ClovingGPT(options)
  }

  /**
   * Generates a prompt to explain a shell script.
   * @param {string} prompt - The original shell script prompt.
   * @returns {string} The prompt for explaining the shell script.
   * @private
   */
  private generateExplainShellPrompt(prompt: string): string {
    return `${prompt}

# Task

Please briefly explain how this shell script works.`
  }

  /**
   * Generates a shell script based on the given prompt.
   * @param {string} prompt - The user's prompt for generating a shell script.
   * @returns {Promise<string>} A promise that resolves to the generated shell script.
   * @private
   */
  private async generateShell(prompt: string): Promise<string> {
    if (this.chatHistory.length === 0) {
      const systemPrompt = generateShellPrompt()
      this.chatHistory.push({ role: 'user', content: systemPrompt })
      this.chatHistory.push({ role: 'assistant', content: 'What would you like to do?' })
    }
    this.chatHistory.push({ role: 'user', content: prompt })
    return await this.gpt.generateText({ prompt, messages: this.chatHistory })
  }

  /**
   * Displays the generated shell script with syntax highlighting.
   * @param {string} rawShellCommand - The raw shell command to display.
   * @private
   */
  private displayGeneratedShell(rawShellCommand: string) {
    const generatedShell = extractMarkdown(rawShellCommand)
    const generatedShellWithoutShebang = generatedShell.replace(/^#!.*?\s/, '')
    console.log(highlight(generatedShellWithoutShebang))
  }

  /**
   * Handles user actions after generating a shell script.
   * @param {string} response - The generated shell script.
   * @param {string} prompt - The original user prompt.
   * @returns {Promise<void>}
   * @private
   */
  private async handleUserAction(response: string, prompt: string): Promise<void> {
    let { exec } = this.options
    this.chatHistory.push({ role: 'assistant', content: response })

    const generatedShell = extractMarkdown(response)
    const generatedShellWithoutShebang = generatedShell.replace(/^#!.*?\s/, '')

    if (exec) {
      execSync(generatedShellWithoutShebang, { stdio: 'inherit' })
      return
    }

    const action = await select({
      message: 'What would you like to do?',
      choices: [
        { name: 'Execute', value: 'execute' },
        { name: 'Revise', value: 'revise' },
        { name: 'Explain', value: 'explain' },
        { name: 'Copy to Clipboard', value: 'copy' },
        { name: 'Cancel', value: 'cancel' },
      ],
    })

    switch (action) {
      case 'execute':
        execSync(generatedShellWithoutShebang, { stdio: 'inherit' })
        break
      case 'revise':
        const newPrompt = await input({
          message: 'How would you like to modify the output:',
        })
        const newRawShellCommand = await this.generateShell(newPrompt)
        this.displayGeneratedShell(newRawShellCommand)
        await this.handleUserAction(newRawShellCommand, newPrompt)
        break
      case 'explain':
        const explainPrompt = this.generateExplainShellPrompt(generatedShellWithoutShebang)
        this.chatHistory.push({ role: 'user', content: explainPrompt })
        const explainShellCommand = await this.gpt.generateText({
          prompt: explainPrompt,
          messages: this.chatHistory,
        })
        console.log(highlight(explainShellCommand, { language: 'markdown' }))
        break
      case 'copy':
        ncp.copy(generatedShellWithoutShebang, (err) => {
          if (err) {
            console.error('Error: Unable to copy to clipboard.', err)
          } else {
            console.log('Script copied to clipboard.')
          }
        })
        break
      case 'cancel':
        console.log('Operation cancelled.')
        break
    }
  }

  /**
   * Generates a shell script based on user input and handles subsequent user actions.
   *
   * This method is the main entry point for generating and interacting with shell scripts.
   * It performs the following steps:
   * 1. Obtains a user prompt (either from options or by asking the user).
   * 2. Generates a shell script based on the prompt.
   * 3. Displays the generated script with syntax highlighting.
   * 4. Handles user actions (execute, revise, explain, copy, or cancel) for the generated script.
   *
   * @returns {Promise<void>} A promise that resolves when the generation and handling process is complete.
   * @throws {Error} If there's an issue during the shell script generation process.
   * @public
   *
   * @example
   * const shellManager = new ShellManager(options);
   * await shellManager.generateAndHandleShell();
   */
  public async generateAndHandleShell(): Promise<void> {
    let { prompt: userPrompt } = this.options
    try {
      if (!userPrompt) {
        userPrompt = await input({
          message: 'What would you like to do: ',
        })
      }

      const rawShellCommand = await this.generateShell(userPrompt)
      this.displayGeneratedShell(rawShellCommand)
      await this.handleUserAction(rawShellCommand, userPrompt)
    } catch (error) {
      console.error('Could not generate shell script', error)
    }
  }
}

export default ShellManager
