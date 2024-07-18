
import inquirer from 'inquirer'
import highlight from 'cli-highlight'
import { execSync } from 'child_process'
import ncp from 'copy-paste'
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

## Task

Please briefly explain how this shell script works.`
}

const generateShell = async (gpt: ClovingGPT, prompt: string): Promise<string> => {
  const shellPrompt = generateShellPrompt(prompt)
  return await gpt.generateText({ prompt: shellPrompt })
}

const displayGeneratedShell = (rawShellCommand: string) => {
  const generatedShell = extractMarkdown(rawShellCommand)
  const generatedShellWithoutShebang = generatedShell.replace(/^#!.*?\s/, '')
  console.log(highlight(generatedShellWithoutShebang))
}

const handleUserAction = async (gpt: ClovingGPT, rawShellCommand: string, prompt: string): Promise<void> => {
  const generatedShell = extractMarkdown(rawShellCommand)
  const generatedShellWithoutShebang = generatedShell.replace(/^#!.*?\s/, '')

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
      const { newPrompt } = await inquirer.prompt<{ newPrompt: string }>([
        {
          type: 'input',
          name: 'newPrompt',
          message: 'How would you like to modify the output:',
        },
      ])
      const newRawShellCommand = await generateShell(gpt, newPrompt)
      displayGeneratedShell(newRawShellCommand)
      await handleUserAction(gpt, newRawShellCommand, newPrompt)
      break
    case 'explain':
      const explainPrompt = generateExplainShellPrompt(generatedShellWithoutShebang)
      const explainShellCommand = await gpt.generateText({ prompt: explainPrompt })
      console.log(highlight(explainShellCommand, { language: 'markdown' }))
      break
    case 'copy':
      ncp.copy(generatedShellWithoutShebang, (err) => {
        if (err) {
          console.error('Error: Unable to copy to clipboard.', err)
        } else {
          console.log('Script copied to clipboard.')
        }
      })
      break
    case 'cancel':
      console.log('Operation cancelled.')
      break
  }
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

    const rawShellCommand = await generateShell(gpt, prompt)
    displayGeneratedShell(rawShellCommand)
    await handleUserAction(gpt, rawShellCommand, prompt)
  } catch (error) {
    console.error('Could not generate shell script', error)
  }
}

export default shell
