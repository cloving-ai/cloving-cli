import { execFileSync } from 'child_process'
import { getGitDiff } from '../utils/gitUtils'
import { getModel } from '../utils/modelUtils'

const analyze = () => {
  try {
    // Define the prompt for analysis
    const prompt = `Explain why the change is being made and document a description of these changes.
Also list any bugs in the new code as well as recommended fixes for those bugs with code examples.

${getGitDiff()}`

    // Get the analysis from the AI chat model
    const analysis = execFileSync('aichat', ['-m', getModel(), '-r', 'coder', prompt]).toString()

    // Try to copy the analysis to clipboard using pbcopy
    try {
      execFileSync('pbcopy', { input: analysis })
      console.log('Analysis copied to clipboard')
    } catch (error) {
      // could not copy to clipboard
    }
  } catch (error) {
    console.error('Error during analysis:', (error as Error).message)
  }
}

export default analyze
