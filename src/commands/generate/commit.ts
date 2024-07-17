import fs from 'fs'
import path from 'path'
import { execFileSync, execSync } from 'child_process'
import { extractMarkdown } from '../../utils/string_utils'
import { getConfig } from '../../utils/config_utils'
import ClovingGPT from '../../cloving_gpt'
import type { ClovingGPTOptions } from '../../utils/types'

const generateCommitMessagePrompt = (diff: string): string => {
  return `Generate a concise and meaningful commit message based on a diff.

Do not add any commentary or context to the message other than the commit message itself.

An example of the output for this should look like the following:

\`\`\`plaintext
Update dependencies and package versions

- Upgrade Ruby gems including aws-sdk, honeybadger, irb, and rubocop
- Update Node.js packages including esbuild, tinymce, and trix
- Bump TypeScript and ESLint related packages to latest versions
\`\`\`

Here is the diff to help you write the commit message:

${diff}`
}

const commit = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false
  const gpt = new ClovingGPT(options)
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
    console.error('Could not generate commit message:', error)
  }
}

export default commit
