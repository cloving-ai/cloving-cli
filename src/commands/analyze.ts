import { execFileSync } from 'child_process'
import readline from 'readline'
import { getGitDiff } from '../utils/git_utils'
import { getModel } from '../utils/model_utils'

const analyze = () => {
  try {
    // Define the prompt for analysis
    const prompt = `Explain why the change is being made and document a description of these changes.
Also list any bugs in the new code as well as recommended fixes for those bugs with code examples.

${getGitDiff()}`

    // Get the analysis from the AI chat model
    const analysis = execFileSync('aichat', ['-m', getModel(), '-r', 'coder', prompt]).toString()

    // Print the analysis to the console
    console.log(analysis)

    // Prompt the user to copy the analysis to the clipboard
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.question('Do you want to copy the analysis to the clipboard? [Y/n] ', (answer) => {
      if (answer.toLowerCase() === 'y' || answer === '') {
        try {
          execFileSync('pbcopy', { input: analysis })
          console.log('Analysis copied to clipboard')
        } catch (error) {
          console.error('Error: pbcopy command not found. Unable to copy to clipboard.')
        }
      } else {
        console.log('Analysis was not copied to clipboard.')
      }
      rl.close()
    })
  } catch (error) {
    console.error('Error during analysis:', (error as Error).message)
  }
}

export default analyze
