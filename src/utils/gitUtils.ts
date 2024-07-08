import { execSync } from 'child_process'

export const generateCommitMessagePrompt = (): string => {
  const diff = execSync('git diff').toString()
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

export const getGitDiff = (): string => {
  try {
    let mainBranchName: string

    mainBranchName = execSync('git symbolic-ref refs/remotes/origin/HEAD | sed \'s@^refs/remotes/origin/@@\'')
      .toString()
      .trim()
    console.log('Initial mainBranchName:', mainBranchName)

    if (mainBranchName === '') {
      console.error('Error determining default branch. Attempting to set it automatically...')
      execSync('git remote set-head origin -a')
      mainBranchName = execSync('git symbolic-ref refs/remotes/origin/HEAD | sed \'s@^refs/remotes/origin/@@\'')
        .toString()
        .trim()
      console.log('Updated mainBranchName after setting head:', mainBranchName)

      if (mainBranchName === '') {
        throw new Error('Error: Could not determine the default branch (main or master)')
      }
    }

    const gitDiff = execSync(`git diff ${mainBranchName} --`).toString().trim()
    return gitDiff
  } catch (error) {
    console.error('Error getting git diff:', (error as Error).message)
    process.exit(1)
  }
}
