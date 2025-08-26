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
  private autoAccept: boolean

  constructor(options: ClovingGPTOptions) {
    options.silent = getConfig(options).globalSilent || false
    this.autoAccept = options.autoAccept || false
    this.gpt = new ClovingGPT(options)
  }

  private async generateCommitWithSimplifiedDiff(): Promise<void> {
    // Get a simplified diff (just the file names and basic stats)
    const diffStat = execSync('git diff HEAD --stat').toString().trim()
    const diffNameOnly = execSync('git diff HEAD --name-only').toString().trim()

    const simplifiedPrompt = `Generate a conventional commit message following the Conventional Commits specification.

Files changed:
${diffNameOnly}

Change summary:
${diffStat}

Generate a concise conventional commit message in the format:
<type>[optional scope]: <description>

Do not add any commentary or context to the message other than the commit message itself.`

    // Get the commit message with simplified context
    const rawCommitMessage = await this.gpt.generateText({ prompt: simplifiedPrompt })
    const commitMessage = this.cleanCommitMessage(extractMarkdown(rawCommitMessage))

    if (this.autoAccept) {
      try {
        execFileSync('git', ['commit', '-a', '-m', commitMessage], {
          stdio: 'inherit',
        })
      } catch (commitError) {
        console.log('Commit failed:', (commitError as Error).message)
      }
    } else {
      // Write the commit message to a temporary file
      const tempCommitFilePath = path.join('.git', 'SUGGESTED_COMMIT_EDITMSG')
      fs.writeFileSync(tempCommitFilePath, commitMessage)

      // Commit the changes using the generated commit message
      try {
        execFileSync('git', ['commit', '-a', '--edit', '--file', tempCommitFilePath], {
          stdio: 'inherit',
        })
      } catch (commitError) {
        console.log('Commit was canceled or failed.')
      }

      // Remove the temporary file
      fs.unlink(tempCommitFilePath, (err) => {
        if (err) throw err
      })
    }
  }

  private cleanCommitMessage(message: string): string {
    // First check if there's a conventional commit message inside a code block
    const conventionalCommitRegex = /```\n([a-z]+(?:\([^)]+\))?: [\s\S]*?)```/m
    const conventionalMatch = message.match(conventionalCommitRegex)

    if (conventionalMatch) {
      return conventionalMatch[1].trim()
    }

    // Remove markdown code block formatting if present, including any text before and after
    const codeBlockRegex = /.*?```.*\n([\s\S]*?)\n```.*/m
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

      if (this.autoAccept) {
        // Directly commit with the generated message without opening an editor
        try {
          execFileSync('git', ['commit', '-a', '-m', commitMessage], {
            stdio: 'inherit',
          })
        } catch (commitError) {
          console.log('Commit failed:', (commitError as Error).message)
        }
      } else {
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
      }
    } catch (err) {
      const error = err as Error

      // Check if error is due to token limit (prompt too long)
      if (
        error.message.includes('prompt is too long') ||
        error.message.includes('too many tokens') ||
        error.message.includes('maximum')
      ) {
        console.warn('Prompt too long, retrying with simplified diff...')
        try {
          await this.generateCommitWithSimplifiedDiff()
          return
        } catch (retryErr) {
          console.error(
            'Could not generate commit message even with simplified diff:',
            (retryErr as Error).message,
          )
          return
        }
      }

      console.error('Could not generate commit message:', error.message)
    }
  }
}

export default CommitManager
