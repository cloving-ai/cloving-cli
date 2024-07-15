import { promises as fs } from 'fs'

import ClovingGPT from '../../cloving_gpt'
import { getConfig, saveProjectConfig, getProjectConfig } from '../../utils/config_utils'
import { getCurrentBranchName } from '../../utils/git_utils'
import type { ClovingGPTOptions } from '../../utils/types'

const parsePlan = (plan: string): Record<string, any> => {
  const lines = plan.split('\n').map(line => line.trim())
  const structured: Record<string, any> = {}
  let currentTitle: string | null = null
  let currentDetails: string[] = []

  lines.forEach(line => {
    const sectionMatch = line.match(/^#### \d+\. \*\*(.+)\*\*$/)
    const detailMatch = line.match(/^-\s*\*\*(.+)\*\*:?\s*(.+)$/)

    if (sectionMatch) {
      if (currentTitle) {
        structured[currentTitle] = {
          details: currentDetails
        }
      }
      currentTitle = sectionMatch[1]
      currentDetails = []
    } else if (detailMatch && currentDetails) {
      currentDetails.push(`${detailMatch[1]}: ${detailMatch[2]}`)
    } else if (currentDetails && line.startsWith('- ')) {
      currentDetails.push(line.replace(/^- /, ''))
    }
  })

  if (currentTitle) {
    structured[currentTitle] = {
      details: currentDetails
    }
  }

  return structured
}

const generatePrompt = async (projectName: string, projectTask: string, filesList: string[]) => {
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

Please create a plan to execute this project. Do not include the Implementation Steps. Only include Plan for Project Execution.

Here is an example plan. Do not use any of the information from this plan in your response, only use it as a template to create your own plan.

==== begin example plan ====
### Plan for Project Execution

#### 1. **Understanding Existing Code**
   - **Review existing command implementations**: Familiarize yourself with the structure and implementation style of existing commands such as project init and project plan.
   - **Identify utility functions**: Note the utility functions being used across the commands, such as those in config_utils, git_utils, and command_utils.

#### 2. **Design New Commands**
   - **Define functionalities**: Clearly outline what each new command should accomplish:
     - project build: This command should compile or prepare the project based on the planned actions.
     - project complete: This command should finalize the project, possibly including cleanup, documentation, or deployment steps.

#### 3. **Implement project build**
   - **Create build.ts**: Implement the logic for building the project.
     - **Generate prompt**: Create a prompt that describes the build process based on the project configuration.
     - **Invoke AI Model**: Use an AI model to generate the steps or scripts needed to build the project.
     - **Execute Build Steps**: Implement logic to execute the build steps.

#### 4. **Implement project complete**
   - **Create complete.ts**: Implement the logic for completing the project.
     - **Generate prompt**: Create a prompt that describes the completion process based on the project configuration.
     - **Invoke AI Model**: Use an AI model to generate the steps or scripts needed to complete the project.
     - **Execute Completion Steps**: Implement logic to execute the completion steps.

#### 5. **Integration and Testing**
   - **Integrate new commands**: Ensure the new commands are integrated into the existing command structure.
   - **Unit tests**: Develop unit tests for the new commands to ensure they function correctly.
   - **End-to-end tests**: Run end-to-end tests to validate the entire workflow from project initialization to completion.

#### 6. **Documentation and Cleanup**
   - **Update README**: Document the new commands and their usage.
   - **Code cleanup**: Refactor and clean up any redundant code or comments.
==== end example plan ====`
}

export const planProject = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false
  const gpt = new ClovingGPT(options)

  const projectName = getCurrentBranchName()
  const projectConfig = getProjectConfig(projectName)

  const prompt = await generatePrompt(projectName, projectConfig.task, projectConfig.files || [])
  const projectPlan = await gpt.generateText({ prompt })

  const planItems = parsePlan(projectPlan)
  console.log(planItems)

  projectConfig.plan = planItems
  saveProjectConfig(projectName, projectConfig)
}

export default planProject
