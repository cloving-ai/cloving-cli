import ncp from 'copy-paste'
import colors from 'colors'
import { select } from '@inquirer/prompts'
import { AxiosError } from 'axios'

import ClovingGPT from '../cloving_gpt'
import { getGitDiff } from '../utils/git_utils'
import { generateReviewPrompt } from '../utils/prompt_utils'
import { getConfig } from '../utils/config_utils'
import StreamManager from './StreamManager'
import type { ClovingGPTOptions } from '../utils/types'

class ReviewManager extends StreamManager {
  constructor(options: ClovingGPTOptions) {
    super(options)
    options.silent = getConfig(options).globalSilent || false
    options.stream = true
    this.gpt = new ClovingGPT(options)
  }

  private async getGitDiffPrompt(): Promise<string> {
    const gitDiff = await getGitDiff()
    return `${generateReviewPrompt(this.options, this.contextFiles)}

## Diff Content
${gitDiff}

# Task

${this.options.prompt || 'Please provide a code review.'}`
  }

  private async handleUserAction(analysis: string) {
    const extractSection = (section: string): string => {
      const regex = new RegExp(
        `## ${section}[\\s\\S]*?(?=\\n## Potential Bugs and Recommended Fixes|$)`,
        'g',
      )
      const match = analysis.match(regex)
      return match ? match[0].trim() : ''
    }

    const clipboardOption = await select({
      message: 'What would you like to copy to the clipboard?',
      choices: [
        { name: 'Copy only the Changes Overview', value: 'Changes Overview' },
        {
          name: 'Copy only the Potential Bugs and Recommended Fixes',
          value: 'Potential Bugs and Recommended Fixes',
        },
        { name: 'Copy everything', value: 'Everything' },
        { name: 'Done', value: 'Done' },
      ],
    })

    let contentToCopy = ''

    switch (clipboardOption) {
      case 'Changes Overview':
        contentToCopy = extractSection('Changes Overview')
        break
      case 'Potential Bugs and Recommended Fixes':
        contentToCopy = extractSection('Potential Bugs and Recommended Fixes')
        break
      case 'Everything':
        contentToCopy = analysis
        break
      case 'Done':
        console.log('No content copied to clipboard.')
        return
    }

    if (contentToCopy) {
      ncp.copy(contentToCopy, (err) => {
        if (err) {
          console.error(colors.red('Error: Unable to copy to clipboard.'), err)
        } else {
          console.log(colors.green('Selected content copied to clipboard'))
        }
      })
    }
  }

  public async generateReview(extraPrompt?: string): Promise<void> {
    try {
      await this.checkForLatestVersion()
      await this.loadContextFiles()

      if (this.options.files) {
        if (this.chatHistory.length === 0) {
          this.addUserPrompt(`${generateReviewPrompt(this.options, this.contextFiles)}`)
          this.addAssistantResponse('What would you like to do?')
        }
        this.addUserPrompt(
          `${this.options.prompt || 'Please provide a code review.'}\n\n${extraPrompt || ''}`,
        )
      } else {
        if (this.chatHistory.length === 0) {
          this.addUserPrompt(await this.getGitDiffPrompt())
          this.addAssistantResponse('What would you like to do?')
        }
        this.addUserPrompt(
          `${this.options.prompt || 'Please provide a code review.'}\n\n${extraPrompt || ''}`,
        )
      }

      const responseStream = await this.gpt.streamText({
        prompt: this.prompt,
        messages: this.chatHistory,
      })

      this.handleResponseStream(responseStream)
    } catch (error) {
      this.handleError(error as AxiosError)
    }
  }

  private handleError(error: AxiosError) {
    let errorMessage = error.message || 'An error occurred.'
    const errorNumber = error.response?.status || 'unknown'

    switch (errorNumber) {
      case 400:
        errorMessage = 'Invalid model or prompt size too large. Try specifying fewer files.'
        break
      case 403:
        errorMessage = 'Inactive subscription or usage limit reached'
        break
      case 429:
        errorMessage = 'Rate limit error'
        break
      case 500:
        errorMessage = 'Internal server error'
        break
    }

    const statusMessage = (error.response?.data as any)?.statusMessage
    console.error(
      colors.red(
        `\nError (${errorNumber}) while submitting the prompt to the AI API\n\n${statusMessage}\n`,
      ),
    )
    this.isProcessing = false
  }

  protected async finalizeResponse(): Promise<void> {
    this.addAssistantResponse(this.responseString)
    this.isProcessing = false

    await this.handleUserAction(this.responseString)
  }
}

export default ReviewManager
