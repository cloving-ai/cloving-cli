import ncp from 'copy-paste'
import { promises as fs } from 'fs'
import highlight from 'cli-highlight'
import inquirer from 'inquirer'

import ClovingGPT from '../../cloving_gpt'
import { getConfig, getProjectConfig } from '../../utils/config_utils'
import { getCurrentBranchName } from '../../utils/git_utils'
import { parseMarkdownInstructions } from '../../utils/string_utils'
import type { ClovingGPTOptions } from '../../utils/types'

const generatePrompt = async (projectName: string, projectTask: string, filesList: string[], incompletePlanItem: string) => {
  const context: string[] = []

  for (const codeFile of filesList) {
    if (await fs?.stat(codeFile).then(stat => stat.isFile()).catch(() => false)) {
      const fileContents = await fs.readFile(codeFile, 'utf-8')
      context.push(`### **Contents of ${codeFile}**\n\n${fileContents}\n\n### **End of ${codeFile}**`)
    }
  }

  return `==== begin task description ====
Task name: ${projectName}
Task description: ${projectTask}
==== end task description ====

${context}

Please implement the following plan item, please include full file path names in all code snippets:

${incompletePlanItem}`
}

export const buildProject = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false
  const gpt = new ClovingGPT(options)

  const projectName = getCurrentBranchName()
  const projectConfig = getProjectConfig(projectName)

  // Filter out completed plan items for selection
  const planItems = Object.entries(projectConfig.plan || {})

  if (planItems.length === 0) {
    console.log('No plan items found.')
    process.exit(1)
  }

  // Use inquirer to select a plan item
  const { selectedPlanItemKey } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedPlanItemKey',
      message: 'Select a plan item:',
      choices: planItems.map(([key, item]) => ({ name: key, value: key })),
    },
  ])

  const selectedPlanItem = planItems.find(([key]) => key === selectedPlanItemKey)
  if (!selectedPlanItem) {
    console.log('Selected plan item not found.')
    process.exit(1)
  }

  const planText = `## **${selectedPlanItem[0]}**\n\n${selectedPlanItem[1].details.join('\n\n')}`

  const prompt = await generatePrompt(projectName, projectConfig.task, projectConfig.files || [], planText)
  const projectCode = await gpt.generateText({ prompt })

  parseMarkdownInstructions(projectCode).map(code => {
    if (code.trim().startsWith('```')) {
      const lines = code.split('\n')
      const language = code.match(/```(\w+)/)?.[1] || 'plaintext'
      console.log(lines[0])
      console.log(highlight(lines.slice(1, -1).join('\n'), { language }))
      console.log(lines.slice(-1)[0])
    } else {
      console.log(highlight(code, { language: 'markdown' }))
    }
  })

  // Prompt the user to copy the project to the clipboard using inquirer
  const { copyToClipboard } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'copyToClipboard',
      message: 'Do you want to copy this project to the clipboard?',
      default: true,
    },
  ])

  if (copyToClipboard) {
    ncp.copy(projectCode, () => {
      console.log('Project copied to clipboard')
    })
  }
}

export default buildProject
