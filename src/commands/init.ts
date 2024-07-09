import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { estimateTokens } from '../utils/string_utils'
import ClovingGPT from '../cloving_gpt'
import readline from 'readline'
import ignore from 'ignore'
import { extractJsonMetadata } from '../utils/string_utils'
import type { ClovingConfig } from '../utils/types'

const specialFiles = [
  'package.json',
  'Gemfile',
  'requirements.txt',
  'Pipfile',
  'pyproject.toml',
  'pom.xml',
  'build.gradle',
  '.csproj',
  'packages.config',
  'composer.json',
  'CMakeLists.txt',
  'conanfile.txt',
  'conanfile.py',
  'go.mod',
  'Cargo.toml',
  'Package.swift',
  'build.gradle.kts',
  'Podfile',
  'Cartfile',
  'cpanfile',
  'DESCRIPTION',
  'mix.exs',
  'build.sbt',
  'pubspec.yaml',
  'stack.yaml',
  'cabal.project',
  'Project.toml',
  'rockspec',
  'rebar.config',
  'project.clj'
]

const runCommand = (command: string, args: string[]): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args)
    const output: string[] = []

    process.stdout.on('data', (data) => {
      output.push(data.toString())
    })

    process.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`)
    })

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} process exited with code ${code}`))
      } else {
        resolve(output.join('').trim().split('\n'))
      }
    })
  })
}

const generateFileList = async (): Promise<string[]> => {
  try {
    const lsOutput = await runCommand('ls', [])
    const findOutput = await runCommand('find', ['.'])
    const cleanedFindOutput = findOutput.map(file => file.startsWith('./') ? file.slice(2) : file)
    const files = [...lsOutput, ...cleanedFindOutput]
    const uniqueFiles = Array.from(new Set(files))
    return uniqueFiles.filter(file => file && !file.includes('.git') && !file.includes('node_modules') && !file.includes('tmp'))
  } catch (error) {
    console.error('Error generating file list:', (error as Error).message)
    return []
  }
}

const collectSpecialFileContents = (): Record<string, string | Record<string, unknown>> => {
  const specialFileContents: Record<string, string | Record<string, unknown>> = {}
  for (const file of specialFiles) {
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf-8')
        specialFileContents[file] = file.endsWith('.json') ? JSON.parse(content) : content
      } catch (error) {
        specialFileContents[file] = fs.readFileSync(file, 'utf-8')
      }
    }
  }
  return specialFileContents
}

const checkForSpecialFiles = (): boolean => {
  return specialFiles.some(file => fs.existsSync(file))
}

const getConfig = (): ClovingConfig | null => {
  const configPath = path.join(os.homedir(), '.cloving.json')
  if (fs.existsSync(configPath)) {
    const rawConfig = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(rawConfig)
  }
  return null
}

const saveConfig = (config: ClovingConfig) => {
  const configPath = path.join(os.homedir(), '.cloving.json')
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

const promptUser = (question: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

const fetchModels = async (): Promise<string[]> => {
  try {
    const modelsOutput = await runCommand('cloving', ['models'])
    return modelsOutput
  } catch (error) {
    console.error('Error fetching models:', (error as Error).message)
    return []
  }
}

// Main function for the describe command
export const init = async () => {
  const specialFileContents = collectSpecialFileContents()
  const specialFileNames = Object.keys(specialFileContents).map(file => ' - ' + file)

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

  const config = getConfig()
  if (!config) {
    const models = await fetchModels()
    if (models.length === 0) {
      console.error('No models available.')
      return
    }

    console.log('Available models:')
    models.forEach((model, index) => console.log(`${index + 1}. ${model}`))

    const modelIndex = parseInt(await promptUser('Select a model by number: '), 10) - 1
    if (modelIndex < 0 || modelIndex >= models.length) {
      console.error('Invalid selection.')
      return
    }

    const selectedModel = models[modelIndex]
    const apiKey = await promptUser('Enter your API key: ')

    saveConfig({ CLOVING_MODEL: selectedModel, CLOVING_API_KEY: apiKey })

    console.log(`Configuration saved to ${path.join(os.homedir(), '.cloving.json')}`)
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

Here is an example response:

{
  "languages": [
    {
      "name": "TypeScript",
      "version": "~> 5.5.3"
      "primary": true
    },
    {
      "name": "JavaScript",
      "version": "ES6+"
    }
  ],
  "frameworks": [
    {
      "name": "Node.js",
      "type": "Runtime environment",
      "primary": true
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

    if (process.env.DEBUG === '1') {
      estimateTokens(prompt).then(tokenCount => {
        console.log(`Estimated token count: ${tokenCount}`)
      })
    }

    const gpt = new ClovingGPT()
    const aiChatResponse = await gpt.generateText({ prompt })
    const cleanAiChatResponse = extractJsonMetadata(aiChatResponse)

    fs.writeFileSync(tempFilePath, cleanAiChatResponse)

    // Save the AI chat response to cloving.json
    fs.writeFileSync('cloving.json', cleanAiChatResponse)
    console.log('[done] Project data saved to cloving.json')

    // Prompt the user if they want to review the generated cloving.json
    const reviewAnswer = await promptUser('Do you want to review the generated data? [Yn] ')
    if (reviewAnswer.toLowerCase() === 'y' || reviewAnswer.trim() === '') {
      console.log(cleanAiChatResponse)
    }

    // Clean up
    fs.unlinkSync(tempFilePath)
  } catch (error) {
    console.error('Error describing the project:', (error as Error).message)
  }
}

export default init
