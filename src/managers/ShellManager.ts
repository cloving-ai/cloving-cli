import highlight from 'cli-highlight'
import ncp from 'copy-paste'
import { execSync } from 'child_process'
import { select, input } from '@inquirer/prompts'

import ClovingGPT from '../cloving_gpt'
import { generateShellPrompt } from '../utils/prompt_utils'
import { extractMarkdown } from '../utils/string_utils'
import { getConfig } from '../utils/config_utils'

import type { ClovingGPTOptions, ChatMessage } from '../utils/types'

class ShellManager {
  private gpt: ClovingGPT
  private chatHistory: ChatMessage[] = []

  constructor(private options: ClovingGPTOptions) {
    options.silent = getConfig(options).globalSilent || false
    this.gpt = new ClovingGPT(options)
  }

  private generateExplainShellPrompt(prompt: string): string {
    return `${prompt}

# Task

Please briefly explain how this shell script works.`
  }

  private async generateShell(prompt: string): Promise<string> {
    if (this.chatHistory.length === 0) {
      const systemPrompt = generateShellPrompt()
      this.chatHistory.push({ role: 'user', content: systemPrompt })
      this.chatHistory.push({ role: 'assistant', content: 'What would you like to do?' })
    }
    this.chatHistory.push({ role: 'user', content: prompt })
    return await this.gpt.generateText({ prompt, messages: this.chatHistory })
  }

  private displayGeneratedShell(rawShellCommand: string) {
    const generatedShell = extractMarkdown(rawShellCommand)
    const generatedShellWithoutShebang = generatedShell.replace(/^#!.*?\s/, '')
    console.log(highlight(generatedShellWithoutShebang))
  }

  private async handleUserAction(response: string, prompt: string): Promise<void> {
    this.chatHistory.push({ role: 'assistant', content: response })

    const generatedShell = extractMarkdown(response)
    const generatedShellWithoutShebang = generatedShell.replace(/^#!.*?\s/, '')

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
