import { promises as fs } from 'fs'
import inquirer from 'inquirer'

import ClovingGPT from '../../cloving_gpt'
import { getConfig, saveProjectConfig } from '../../utils/config_utils'
import { getCurrentBranchName, getDefaultBranchName } from '../../utils/git_utils'
import { getAllFiles, getClovingConfig } from '../../utils/config_utils'
import type { ClovingGPTOptions, ProjectConfig } from '../../utils/types'

const generatePrompt = async (projectName: string, projectTask: string) => {
  const filesList = await getAllFiles({}, false)

  return `Here is a description of my app:

${JSON.stringify(getClovingConfig(), null, 2)}

Here is a list of all my source files:

==== begin list of source files ====
${filesList.join("\n")}
==== end list of source files ====

Please enumerate all the files in the provided list that are pertinent for this task:

==== begin task description ====
Task name: ${projectName}
Task description: ${projectTask}
==== end task description ====

Also, list any test files that might be relevant to these files.

Give me this output format for your answer:

## files

app/models/foo.rb
app/views/baz/bar.html.erb

## relevant test files

test/models/foo_test.rb
test/controllers/baz_controller_test.rb`
}

export const initProject = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false
  const gpt = new ClovingGPT(options)

  const defaultBranchName = await getDefaultBranchName()
  const projectName = getCurrentBranchName()

  if (projectName === defaultBranchName) {
    console.log(`You are on the ${defaultBranchName} branch. Please checkout to a git branch and try again. For example: git branch -b my-new-project`)
    process.exit(1)
  }

  const { projectTask } = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectTask',
      message: 'Describe the task you want to accomplish with this project:',
    },
  ])

  const prompt = await generatePrompt(projectName, projectTask)
  const contextFiles = await gpt.generateText({ prompt })

  // Initialize variables
  const lines: string[] = []
  const files: string[] = []

  // Read each line of the context files
  contextFiles.split('\n').forEach((line) => {
    if (line.trim()) {
      lines.push(line.trim())
    }
  })

  for (const codeFile of lines) {
    if (await fs?.stat(codeFile).then(stat => stat.isFile()).catch(() => false)) {
      files.push(codeFile)
    }
  }

  const projectConfig: ProjectConfig = {
    name: projectName,
    task: projectTask,
    files
  }

  saveProjectConfig(projectName, projectConfig)
}

export default initProject
