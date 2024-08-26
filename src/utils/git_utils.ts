/**
 * @module git_utils
 * @description Provides utility functions for Git operations and commit message generation.
 */

import { execSync } from 'child_process'
import readline from 'readline'

/**
 * Prompts the user with a question and returns their answer.
 * @param {string} question - The question to ask the user.
 * @returns {Promise<string>} A promise that resolves with the user's answer.
 */
const askQuestion = (question: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    }),
  )
}

/**
 * Retrieves the Git diff between the current branch and the default branch.
 * @returns {Promise<string>} A promise that resolves with the indented Git diff.
 * @throws {Error} If there's an error getting the Git diff.
 */
export const getGitDiff = async (): Promise<string> => {
  try {
    const defaultBranchName = await getDefaultBranchName()

    const gitDiff = execSync(`git diff ${defaultBranchName} --`).toString().trim()

    // Indent each line by four spaces
    const indentedDiff = gitDiff
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n')

    return indentedDiff
  } catch (error) {
    console.error('Error getting git diff:', (error as Error).message)
    process.exit(1)
  }
}

/**
 * Determines the default branch name for the Git repository.
 * @returns {Promise<string>} A promise that resolves with the default branch name.
 * @throws {Error} If the default branch cannot be determined.
 */
export const getDefaultBranchName = async (): Promise<string> => {
  let defaultBranchName = execSync(
    "git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'",
  )
    .toString()
    .trim()

  if (defaultBranchName === '') {
    console.error('Could not determine the default branch.')

    const answer = await askQuestion('Do you want to run `git remote set-head origin -a`? [Y/n] ')

    if (answer.toLowerCase() === 'y' || answer === '') {
      execSync('git remote set-head origin -a')
      defaultBranchName = await getDefaultBranchName()

      if (defaultBranchName === '') {
        throw new Error('Error: Could not determine the default branch (main or master)')
      }
    } else {
      throw new Error('Operation aborted by user.')
    }
  }

  return defaultBranchName
}

/**
 * Retrieves the name of the current Git branch.
 * @returns {string} The name of the current Git branch.
 * @throws {Error} If there's an error getting the current branch name.
 */
export const getCurrentBranchName = (): string => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
  } catch (error) {
    console.error('Error getting current branch name:', (error as Error).message)
    process.exit(1)
  }
}

/**
 * Generates a prompt for creating a commit message based on a Git diff.
 * @param {string} diff - The Git diff to base the commit message on.
 * @returns {string} A prompt string for generating a commit message.
 */
export const generateCommitMessagePrompt = (diff: string): string => {
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
