import fs from 'fs'
import os from 'os'
import path from 'path'
import { estimateTokens } from '../utils/string_utils'
import ClovingGPT from '../cloving_gpt'
import ignore from 'ignore'
import { extractJsonMetadata } from '../utils/string_utils'
import { getConfig } from '../utils/config_utils'
import { promptUser, generateFileList, collectSpecialFileContents, checkForSpecialFiles } from '../utils/command_utils'
import type { ClovingGPTOptions } from '../utils/types'

// Main function for the describe command
export const init = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false
  const gpt = new ClovingGPT(options)
  const specialFileContents = collectSpecialFileContents()
  const specialFileNames = Object.keys(specialFileContents).map(file => ' - ' + file)

  if (!options.silent) {
    if (specialFileNames.length > 0) {
      console.log(`Cloving will analyze the list of files and the contents of the following files:

${specialFileNames.join("\n")}

Cloving will send AI a request to summarize the technologies used in this project.

This will provide better context for future Cloving requests.

For increased privacy, you can run \`cloving config\` and make sure to configure a local ollama model (llama3:70b-instruct currently works well for this) so that this data is not sent to an AI service provider.
  `)
    } else {
      console.log(`
This script will analyze the list of files in the current directory using GPT to summarize the
technologies used. This will provide better context for future Cloving requests.
      `)
    }
  }

  const config = getConfig(options)
  if (!config || !config?.models) {
    console.error('No cloving configuration found. Please run `cloving config`')
    return
  }

  if (!checkForSpecialFiles()) {
    const continueAnswer = await promptUser('No special files detected. Are you currently inside a software project\'s main directory? Do you want to continue analyzing this directory for the Cloving setup process? [Yn] ')
    if (continueAnswer.toLowerCase() !== 'y' && continueAnswer.trim() !== '') {
      console.log('Operation aborted by the user.')
      return
    }
  }

  const tempFilePath = path.join(os.tmpdir(), `describe_${Date.now()}.tmp`)

  try {
    const gitignorePath = path.join(process.cwd(), '.gitignore')
    const ig = ignore()
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8')
      ig.add(gitignoreContent)
    }

    const fileList = await generateFileList()
    const filteredFileList = fileList.filter(file => {
      try {
        return !ig.ignores(file)
      } catch (error) {
        return false
      }
    })

    const limitedFileList = filteredFileList.slice(0, 100)

    if (specialFileNames.length === 0) {
      console.error('No special files found.')
      return
    }

    const projectDetails = {
      files: limitedFileList,
      specialFiles: specialFileContents
    }

    const prompt = `Here is a JSON object describing my project:
${JSON.stringify(projectDetails, null, 2)}

Please return JSON-formatted metadata about the project, including:

- The programming language(s) used
- The detected framework(s) (if any)
- The version of the language(s)

Here is a typescript interface for the expected response:

interface LanguageConfig {
  name: string
  version?: string
  primary?: boolean
  directory: string
  extension: string
}

interface FrameworkConfig {
  name: string
  type: string
  version?: string
  primary?: boolean
  directory?: string
  extension?: string
}

interface TestingFrameworkConfig {
  name: string
  type: string
  version?: string
  directory?: string
}

interface BuildToolConfig {
  name: string
  type: string
  version?: string
}

interface LinterConfig {
  name: string
  version?: string
  type?: string
}

interface DatabaseConfig {
  name: string
  primary?: boolean
}

export interface ClovingfileConfig {
  languages: LanguageConfig[]
  frameworks: FrameworkConfig[]
  testingFrameworks?: TestingFrameworkConfig[]
  buildTools: BuildToolConfig[]
  packageManager: string
  linters: LinterConfig[]
  databases?: DatabaseConfig[]
  projectType: string
}

Here is an example response:

{
  "languages": [
    {
      "name": "TypeScript",
      "version": "~> 5.5.3"
      "primary": true,
      "directory": "src",
      "extension": ".ts"
    },
    {
      "name": "JavaScript",
      "version": "ES6+",
      "directory": "src",
      "extension": ".js"
    }
  ],
  "frameworks": [
    {
      "name": "Node.js",
      "type": "Runtime environment",
      "primary": true,
      "directory": "src",
      "extension": ".js"
    }
  ],
  "testingFrameworks": [
    {
      "name": "Jest",
      "type": "Testing framework",
      "version": "29.7.0"
      "directory": "tests"
    },
  ],
  "buildTools": [
    {
      "name": "TypeScript Compiler (tsc)",
      "type": "Transpiler"
    },
    {
      "name": "Vite",
      "type": "Build tool",
      "version": "5.3.3"
    }
  ],
  "packageManager": "Yarn",
  "linters": [
    {
      "name": "ESLint",
      "version": "9.6.0"
    }
  ],
  "databases": [
    {
      "name": "MongoDB",
      "version": "5.0.3",
      "primary": true
    }
  ],
  "projectType": "Command-line tool",
}`

    const aiChatResponse = await gpt.generateText({ prompt })
    const cleanAiChatResponse = extractJsonMetadata(aiChatResponse)

    fs.writeFileSync(tempFilePath, cleanAiChatResponse)

    // Save the AI chat response to cloving.json
    fs.writeFileSync('cloving.json', cleanAiChatResponse)
    console.log('[done] Project data saved to cloving.json')

    // Prompt the user if they want to review the generated cloving.json
    if (!options.silent) {
      const reviewAnswer = await promptUser('Do you want to review the generated data? [Yn] ')
      if (reviewAnswer.toLowerCase() === 'y' || reviewAnswer.trim() === '') {
        console.log(cleanAiChatResponse)
      }
    }

    // Clean up
    fs.unlinkSync(tempFilePath)
  } catch (error) {
    console.error('Error describing the project:', (error as Error).message)
  }
}

export default init
