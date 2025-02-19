/**
 * @module git_utils
 * @description Provides utility functions for Git operations and commit message generation.
 */

import { execSync } from 'child_process'
import readline from 'readline'
import fs from 'fs'
import path from 'path'

const COMMITLINT_CONFIG_FILES = [
  '.commitlintrc',
  '.commitlintrc.json',
  '.commitlintrc.yaml',
  '.commitlintrc.yml',
  '.commitlintrc.js',
  '.commitlintrc.cjs',
  '.commitlintrc.mjs',
  '.commitlintrc.ts',
  '.commitlintrc.cts',
  'commitlint.config.js',
  'commitlint.config.cjs',
  'commitlint.config.mjs',
  'commitlint.config.ts',
  'commitlint.config.cts',
]

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
 * Checks if a commitlint configuration file exists in the project.
 * @returns {string | null} The path to the commitlint config file if found, null otherwise.
 */
export const findCommitlintConfig = (): string | null => {
  for (const configFile of COMMITLINT_CONFIG_FILES) {
    if (fs.existsSync(configFile)) {
      return configFile
    }
  }
  return null
}

/**
 * Reads and parses the commitlint configuration file.
 * @param {string} configPath - Path to the commitlint config file.
 * @returns {object | null} The parsed configuration object or null if unable to parse.
 */
export const readCommitlintConfig = (configPath: string): object | null => {
  try {
    const ext = path.extname(configPath)

    if (['.js', '.cjs', '.mjs', '.ts', '.cts'].includes(ext)) {
      // For JavaScript/TypeScript config files, we can't safely require them
      // as they might have dependencies or complex configurations
      return null
    }

    if (['.json', '', '.yaml', '.yml'].includes(ext)) {
      const content = fs.readFileSync(configPath, 'utf-8')

      if (ext === '.json' || ext === '') {
        return JSON.parse(content)
      }

      // For YAML files, we'll just return the raw content as a string
      return { config: content }
    }

    return null
  } catch (error) {
    console.error('Error reading commitlint config:', (error as Error).message)
    return null
  }
}

/**
 * Generates a prompt for creating a commit message based on a Git diff.
 * @param {string} diff - The Git diff to base the commit message on.
 * @returns {string} A prompt string for generating a commit message.
 */
export const generateCommitMessagePrompt = (diff: string): string => {
  // Check if commitlint is configured
  const commitlintConfig = findCommitlintConfig()
  let configInfo = ''

  if (commitlintConfig) {
    const config = readCommitlintConfig(commitlintConfig)
    if (config) {
      configInfo = `\nFound commitlint configuration at ${commitlintConfig}:
\`\`\`json
${JSON.stringify(config, null, 2)}
\`\`\`
Please ensure the commit message follows any additional rules specified in this configuration.
`
    }
  }

  return `Generate a conventional commit message following the Conventional Commits specification (www.conventionalcommits.org).${configInfo}

The commit message should follow this format:
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]

Types must be one of:
- feat: A new feature
- fix: A bug fix
- docs: Documentation only changes
- style: Changes that do not affect the meaning of the code
- refactor: A code change that neither fixes a bug nor adds a feature
- perf: A code change that improves performance
- test: Adding missing tests or correcting existing tests
- build: Changes that affect the build system or external dependencies
- ci: Changes to our CI configuration files and scripts
- chore: Other changes that don't modify src or test files
- revert: Reverts a previous commit

The scope should be the part of the codebase affected.
The description should be imperative, present tense, and not capitalized.
Breaking changes should be indicated by "!" before the ":" or by "BREAKING CHANGE:" in the footer.

Do not add any commentary or context to the message other than the commit message itself.

Here is an example of a valid conventional commit message:

\`\`\`plaintext
feat(api): add new endpoint for user authentication

- Implement JWT token generation
- Add password hashing with bcrypt
- Create user validation middleware

BREAKING CHANGE: 'auth' endpoint now requires API key in headers
\`\`\`

Here is the diff to help you write the commit message:

${diff}`
}
