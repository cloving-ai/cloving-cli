import inquirer from 'inquirer'
import highlight from 'cli-highlight'
import { execSync, execFileSync } from 'child_process'
import { extractMarkdown } from '../../utils/string_utils'
import { getConfig } from '../../utils/config_utils'
import ClovingGPT from '../../cloving_gpt'
import type { ClovingGPTOptions } from '../../utils/types'

const generateShellPrompt = (prompt: string | undefined): string => {
  const shell = execSync('echo $SHELL').toString().trim()
  const os = execSync('echo $OSTYPE').toString().trim()
  return `Generate an executable ${shell} script that works on ${os}. Try to make it a single line if possible and as simple and straightforward as possible.

Do not add any commentary or context to the message other than the commit message itself.

An example of the output for this should look like the following:

\`\`\`sh
find . -type f -name "*.ts" -exec sed -i '' 's/old/new/g' {} +
\`\`\`

Don't use that script, it is only an example.

Here is the description of what I want the script to do:

${prompt}`
}

const generateExplainShellPrompt = (prompt: string): string => {
  return `${prompt}
  
Please briefly explain how this shell script works.`
}

const shell = async (options: ClovingGPTOptions) => {
  let { prompt } = options
  options.silent = getConfig(options).globalSilent || false
  const gpt = new ClovingGPT(options)
  try {
    if (!prompt) {
      const { userPrompt } = await inquirer.prompt<{ userPrompt: string }>([
        {
          type: 'input',
          name: 'userPrompt',
          message: 'What would you like to do: '
        }
      ])
      prompt = userPrompt
    }
    // Generate the prompt for commit message
    const shellPrompt = generateShellPrompt(prompt)

    // Instantiate ClovingGPT and get the commit message
    const rawShellCommand = await gpt.generateText({ prompt: shellPrompt })

    // Clean the commit message using extractMarkdown
    const generatedShell = extractMarkdown(rawShellCommand)
    // remove #! from the generated shell script
    const generatedShellWithoutShebang = generatedShell.replace(/^#!.*?\s/, '')
    console.log(highlight(generatedShellWithoutShebang))

    // Inquirer prompt for further actions
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Execute', value: 'execute' },
          { name: 'Revise', value: 'revise' },
          { name: 'Explain', value: 'explain' },
          { name: 'Copy to Clipboard', value: 'copy' },
          { name: 'Cancel', value: 'cancel' },
        ],
      },
    ])

    switch (action) {
      case 'execute':
        execSync(generatedShellWithoutShebang, { stdio: 'inherit' })
        break
      case 'revise':
        // Logic to revise the prompt (not implemented in this example)
        console.log('Revise option selected. Implement revision logic here.')
        break
      case 'explain':
        const explainPrompt = generateExplainShellPrompt(generatedShellWithoutShebang)
        const explainShellCommand = await gpt.generateText({ prompt: explainPrompt })
        console.log(highlight(explainShellCommand, { language: 'markdown' }))
        break
      case 'copy':
        execFileSync('pbcopy', { input: generatedShellWithoutShebang })
        console.log('Script copied to clipboard.')
        break
      case 'cancel':
        console.log('Operation cancelled.')
        break
    }
  } catch (error) {
    console.error('Could not generate shell script')
  }
}

export default shell
