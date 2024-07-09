import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { estimateTokens, extractJsonMetadata } from '../utils/string_utils'
import ClovingGPT from '../cloving_gpt'
import readline from 'readline'
import ignore from 'ignore'

// List of special files to check
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

// Main function for the describe command
export const describe = async () => {
  // Generate a temporary file path
  const tempFilePath = path.join(os.tmpdir(), `describe_${Date.now()}.tmp`)

  try {
    // Read .gitignore and create ignore instance
    const gitignorePath = path.join(process.cwd(), '.gitignore')
    const ig = ignore()
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8')
      ig.add(gitignoreContent)
    }

    // Generate the file list excluding .git, node_modules and matching .gitignore patterns
    const fileList = await generateFileList()
    const filteredFileList = fileList.filter(file => {
      try {
        return !ig.ignores(file)
      } catch (error) {
        return false
      }
    })

    // Limit the file list to the first 100 files
    const limitedFileList = filteredFileList.slice(0, 100)

    // Collect the contents of special files
    const specialFileContents = collectSpecialFileContents()

    // Generate the JSON object for the AI chat model
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

    // Estimate and print token count if DEBUG=1
    if (process.env.DEBUG === '1') {
      estimateTokens(prompt).then(tokenCount => {
        console.log(`Estimated token count: ${tokenCount}`)
      })
    }

    // Instantiate ClovingGPT and get the AI chat response
    const gpt = new ClovingGPT()
    const aiChatResponse = await gpt.generateText({ prompt })

    // Write the AI chat response to a temporary file
    fs.writeFileSync(tempFilePath, aiChatResponse)

    // Extract JSON metadata from the AI response
    const jsonMetadata = extractJsonMetadata(aiChatResponse)
    if (jsonMetadata) {
      console.log(jsonMetadata)
    } else {
      console.log(aiChatResponse)
    }
    const response = jsonMetadata || aiChatResponse

    // Clean up
    fs.unlinkSync(tempFilePath)

    // Ask user if they want to save the result to cloving.json
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    rl.question('Do you want to save this file to cloving.json to improve the context of future cloving requests? [Yn] ', (answer) => {
      rl.close()
      if (answer.toLowerCase() === 'y' || answer.trim() === '') {
        fs.writeFileSync('cloving.json', response)
        console.log('File saved to cloving.json')
      } else {
        console.log('File not saved.')
      }
    })
  } catch (error) {
    console.error('Error describing the project:', (error as Error).message)
  }
}

export default describe
