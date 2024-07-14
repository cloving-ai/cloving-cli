import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { generateCommitMessagePrompt } from '../utils/git_utils'
import { extractMarkdown } from '../utils/string_utils'
import { getConfig } from '../utils/command_utils'
import ClovingGPT from '../cloving_gpt'
import type { ClovingGPTOptions } from '../utils/types'

const generateAndCommitMessage = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).silent || false
  const gpt = new ClovingGPT(options)
  try {
    // Generate the prompt for commit message
    const prompt = generateCommitMessagePrompt()

    // Instantiate ClovingGPT and get the commit message
    const rawCommitMessage = await gpt.generateText({ prompt })

    // Clean the commit message using extractMarkdown
    const commitMessage = extractMarkdown(rawCommitMessage)

    // Write the commit message to a temporary file
    const tempCommitFilePath = path.join('.git', 'SUGGESTED_COMMIT_EDITMSG')
    fs.writeFileSync(tempCommitFilePath, commitMessage)

    // Commit the changes using the generated commit message
    try {
      execFileSync('git', ['commit', '-a', '--edit', '--file', tempCommitFilePath], { stdio: 'inherit' })
    } catch (commitError) {
      // If commit is canceled (non-zero exit), handle it here
      console.log('Commit was canceled or failed.')
    }

    // Remove the temporary file using fs
    fs.unlink(tempCommitFilePath, (err) => {
      if (err) throw err
    })

  } catch (error) {
    console.error('Could not generate commit message')
  }
}

export default generateAndCommitMessage
