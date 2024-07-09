import { execSync } from 'child_process'
import readline from 'readline'

const askQuestion = (question: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise(resolve => rl.question(question, answer => {
    rl.close()
    resolve(answer)
  }))
}

export const generateCommitMessagePrompt = (): string => {
  const diff = execSync('git diff HEAD').toString()
  return `Generate a concise and meaningful commit message based on a diff.

Do not add any commentary or context to the message other than the commit message itself.

An example of the output for this should look like the following:

# Update dependencies and package versions

- Upgrade Ruby gems including aws-sdk, honeybadger, irb, and rubocop
- Update Node.js packages including esbuild, tinymce, and trix
- Bump TypeScript and ESLint related packages to latest versions

====

Here is the diff to help you write the commit message:

${diff}`
}

export const getGitDiff = async (): Promise<string> => {
  try {
    let mainBranchName: string

    mainBranchName = execSync('git symbolic-ref refs/remotes/origin/HEAD | sed \'s@^refs/remotes/origin/@@\'')
      .toString()
      .trim()

    if (mainBranchName === '') {
      console.error('Could not determine the default branch.')

      const answer = await askQuestion('Do you want to run `git remote set-head origin -a`? [Y/n] ')

      if (answer.toLowerCase() === 'y' || answer === '') {
        execSync('git remote set-head origin -a')
        mainBranchName = execSync('git symbolic-ref refs/remotes/origin/HEAD | sed \'s@^refs/remotes/origin/@@\'')
          .toString()
          .trim()

        if (mainBranchName === '') {
          throw new Error('Error: Could not determine the default branch (main or master)')
        }
      } else {
        throw new Error('Operation aborted by user.')
      }
    }

    const gitDiff = execSync(`git diff ${mainBranchName} --`).toString().trim()
    return gitDiff
  } catch (error) {
    console.error('Error getting git diff:', (error as Error).message)
    process.exit(1)
  }
}
