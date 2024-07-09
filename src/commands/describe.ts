import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync } from 'child_process'
import { estimateTokens, extractJsonMetadata } from '../utils/string_utils'
import ClovingGPT from '../cloving_gpt'

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

// Main function for the describe command
export const describe = async () => {
  // Generate a temporary file path
  const tempFilePath = path.join(os.tmpdir(), `describe_${Date.now()}.tmp`)

  try {
    // Generate the file list excluding .git and node_modules with increased buffer size
    const fileList = execFileSync('sh', ['-c', 'find . | grep -v .git | grep -v node_modules'], { maxBuffer: 10 * 1024 * 1024 }).toString().trim().split('\n')

    // Limit the file list to the first 100 files
    const limitedFileList = fileList.slice(0, 100)

    // Collect the contents of special files
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
    },
    {
      "name": "Jest",
      "type": "Testing framework",
      "version": "29.7.0"
      "directory": "tests"
    }
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
      const tokenCount = await estimateTokens(prompt)
      console.log(`Estimated token count: ${tokenCount}`)
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

    // Clean up
    fs.unlinkSync(tempFilePath)
  } catch (error) {
    console.error('Error describing the project:', (error as Error).message)
  }
}

export default describe
