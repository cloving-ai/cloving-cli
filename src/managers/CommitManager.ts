import fs from 'fs'
import path from 'path'
import { execFileSync, execSync } from 'child_process'
import { extractMarkdown } from '../utils/string_utils'
import { generateCommitMessagePrompt } from '../utils/git_utils'
import { getConfig } from '../utils/config_utils'
import ClovingGPT from '../cloving_gpt'
import type { ClovingGPTOptions } from '../utils/types'
import type { AxiosError } from 'axios'

class CommitManager {
  private gpt: ClovingGPT

  constructor(options: ClovingGPTOptions) {
    options.silent = getConfig(options).globalSilent || false
    this.gpt = new ClovingGPT(options)
  }

  private cleanCommitMessage(message: string): string {
    // Remove markdown code block formatting if present, including any text before and after
    const codeBlockRegex = /.*?```.*\n(.*?)\n```.*/m
    const match = message.match(codeBlockRegex)
    return match ? match[1].trim() : message.trim()
  }

  public async generateCommit(): Promise<void> {
    try {
      // Get the git diff
      const diff = execSync('git diff HEAD').toString().trim()

      // Check if the diff is blank
      if (!diff) {
        console.error('No changes to commit.')
        return
      }

      // Generate the prompt for commit message
      const prompt = generateCommitMessagePrompt(diff)

      // Instantiate ClovingGPT and get the commit message
      const rawCommitMessage = await this.gpt.generateText({ prompt })

      // Clean the commit message using extractMarkdown and remove code blocks
      const commitMessage = this.cleanCommitMessage(extractMarkdown(rawCommitMessage))

      // Write the commit message to a temporary file
      const tempCommitFilePath = path.join('.git', 'SUGGESTED_COMMIT_EDITMSG')
      fs.writeFileSync(tempCommitFilePath, commitMessage)

      // Commit the changes using the generated commit message
      try {
        execFileSync('git', ['commit', '-a', '--edit', '--file', tempCommitFilePath], {
          stdio: 'inherit',
        })
      } catch (commitError) {
        // If commit is canceled (non-zero exit), handle it here
        console.log('Commit was canceled or failed.')
      }

      // Remove the temporary file using fs
      fs.unlink(tempCommitFilePath, (err) => {
        if (err) throw err
      })
    } catch (err) {
      const error = err as AxiosError
      console.error('Could not generate commit message:', error.message)
    }
  }
}

export default CommitManager
