import { promises as fs } from 'fs'
import highlight from 'cli-highlight'
import inquirer from 'inquirer'

import ClovingGPT from '../../cloving_gpt'
import { getConfig, getProjectConfig } from '../../utils/config_utils'
import { getCurrentBranchName } from '../../utils/git_utils'
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

const parseMarkdownInstructions = (input: string): string[] => {
  const lines = input.split('\n')
  const result: string[] = []
  let buffer: string[] = []
  let inCodeBlock = false

  lines.forEach(line => {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        buffer.push(line)
        result.push(buffer.join('\n'))
        buffer = []
        inCodeBlock = false
      } else {
        // Start of code block
        if (buffer.length > 0) {
          result.push(buffer.join('\n'))
          buffer = []
        }
        buffer.push(line)
        inCodeBlock = true
      }
    } else {
      buffer.push(line)
    }
  })

  // If buffer has any remaining lines, add them to the result
  if (buffer.length > 0) {
    result.push(buffer.join('\n'))
  }

  return result
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
  parseMarkdownInstructions(projectCode).map(code => console.log(highlight(code)))
}

export default buildProject
