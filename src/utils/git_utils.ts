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

export const getGitDiff = async (): Promise<string> => {
  try {
    const defaultBranchName = await getDefaultBranchName()

    const gitDiff = execSync(`git diff ${defaultBranchName} --`).toString().trim()
    return gitDiff
  } catch (error) {
    console.error('Error getting git diff:', (error as Error).message)
    process.exit(1)
  }
}

export const getDefaultBranchName = async (): Promise<string> => {
  let defaultBranchName = execSync('git symbolic-ref refs/remotes/origin/HEAD | sed \'s@^refs/remotes/origin/@@\'')
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

export const getCurrentBranchName = (): string => {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
  } catch (error) {
    console.error('Error getting current branch name:', (error as Error).message)
    process.exit(1)
  }
}
