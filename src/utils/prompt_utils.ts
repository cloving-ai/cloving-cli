import fs from 'fs'
import path from 'path'
import { execSync, spawn } from 'child_process'
import { isBinaryFile } from 'isbinaryfile'
import colors from 'colors'
import { join } from 'path'

import { getClovingConfig } from './config_utils'

export const CODEGEN_INSTRUCTIONS = `## AI Code Generation Instructions

### General Guidelines

1. **Respond as an expert software developer.**
2. **Follow best practices and the latest standards found in the **Description of App** section.**
3. **Adhere to existing conventions and libraries in the codebase.**

### Request Handling

1. **Try to understand the request, but if anything is unclear, ask questions.**
2. **Decide if you need to propose edits to existing files not in the chat.**
   - If yes, provide the full path names and ask the user to add them.
   - Wait for user approval before proceeding.
3. **Propose changes using *CURRENT/NEW* Blocks.**
4. **Show the smallest possible *CURRENT* section that uniquely identifies the code.**
5. **To move code, use two *CURRENT/NEW* blocks: one to remove and one to add.**
6. **For new files or to replace an existing file, the *CURRENT* block is empty.**

### *CURRENT/NEW* Block Format

1. **Start a block with three backticks and the language name.**
   \`\`\`typescript
2. **Next line: seven <, CURRENT, and the file path.**
   <<<<<<< CURRENT path/to/file.ts
3. **Include the exact existing code to be changed.**
4. **Divide with seven =.**
   =======
5. **Add the new code.**
6. **End with seven > and NEW.**
   >>>>>>> NEW
7. **Close the block with three backticks.**
   \`\`\``

export const INIT_INSTRUCTIONS = `You are an AI assistant helping to initialize a project by analyzing its structure and technologies.

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
  runCommand?: string
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
      "runCommand": "yarn test"
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

export const SPECIAL_FILES = [
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
  'top.sls',
  'requirements.yml',
  'terraform.tf',
  'versions.tf',
  'main.yml',
  'cabal.project',
  'Project.toml',
  'rockspec',
  'rebar.config',
  'project.clj',
  'tsconfig.json',
  '.eslintrc.js',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
  '.eslintrc',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  '.prettierrc.yaml',
  '.prettierrc.yml',
  '.prettierrc',
  '.stylelintrc',
  '.stylelintrc.json',
  '.stylelintrc.yaml',
  '.stylelintrc.yml',
  '.stylelintrc',
  'jest.config.js',
  'jest.config.json',
  'jest.config.ts',
  'jest.config.cjs',
  'jest.config.mjs',
  'webpack.config.js',
  'webpack.config.ts',
  'webpack.config.cjs',
  'webpack.config.mjs',
  'webpack.config.common.js',
]

export const getPackageVersion = () => {
  const packagePath = join(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  return packageJson.version
}

const renderAsString = (contextFile: Record<string, unknown> | string): string => {
  if (typeof contextFile === 'string') {
    return contextFile
  }
  return JSON.stringify(contextFile, null, 2)
}

export const generateCodegenPrompt = (contextFilesContent: Record<string, string>): string => {
  const specialFileContents = collectSpecialFileContents()
  // detect if specialFileContents[file] is a string or an object
  const specialFiles = Object.keys(specialFileContents)
    .map(
      (file) =>
        `### Contents of **${file}**\n\n\`\`\`\n${renderAsString(specialFileContents[file])}\n\`\`\`\n\n`,
    )
    .join('\n')
  const contextFileContents = Object.keys(contextFilesContent)
    .map(
      (file) => `### Contents of **${file}**\n\n\`\`\`\n${contextFilesContent[file]}\n\`\`\`\n\n`,
    )
    .join('\n')

  const prompt = `${CODEGEN_INSTRUCTIONS}

## Description of App

\`\`\`json
${JSON.stringify(getClovingConfig(), null, 2)}
\`\`\`

## Special Files

${specialFiles.length > 0 ? specialFiles : 'No special files provided.'}

## Context Files

${contextFileContents.length > 0 ? contextFileContents : 'No context files provided.'}

## Directory structure

${Object.keys(contextFilesContent).join('\n')}

${CODEGEN_INSTRUCTIONS}

### Example 1: Changing a Variable

\`\`\`typescript
<<<<<<< CURRENT path/to/file.ts
const myVariable = 'exact'
const oldVariable = 1
=======
const myVariable = 'exact'
const newVariable = 2
>>>>>>> NEW
\`\`\`

### Example 2: Create a New File

\`\`\`ruby
<<<<<<< CURRENT path/to/newfile.rb
=======
def new_function
  puts 'Hello, world!'
end
>>>>>>> NEW
\`\`\`

### Example 3: Moving a Function

Removing it from path/to/file.py

\`\`\`python
<<<<<<< CURRENT path/to/file.py
def old_function():
  return 'Old function'
=======
>>>>>>> NEW
\`\`\`

Adding it to path/to/newfile.py

\`\`\`python
<<<<<<< CURRENT path/to/newfile.py
def existing_function():
  return 'Existing function'

=======
def existing_function():
  return 'Existing function'

def old_function():
  return 'Old function'
>>>>>>> NEW
\`\`\`

### Example 4: Removing a Function

\`\`\`java
<<<<<<< CURRENT path/to/file.java
public void oldFunction() {
  System.out.println("Old function")
}
=======
>>>>>>> NEW
\`\`\`

### Example 5: Replace a file

This will replace the entire contents of **path/to/file.rb** with the new content:

\`\`\`ruby
<<<<<<< CURRENT path/to/file.rb
=======
def new_function
  puts 'Hello, world!'
end
>>>>>>> NEW
\`\`\`

## Don't Invent Code That Isn't Provided in Context

A file might be referenced by just the file name without the full path, but the code must be provided in the *Context Files* section.

Unless you believe you are creating a whole new file, never ever under any circumstances make up code in the CURRENT block that was not provided to you in the *Context Files* section.

If a required file hasn't been provided in the *Context Files* section, stop everything and ask the user to provide it in the context by adding -f path/to/file to the command or add path/to/file in the interactive chat.`
  return prompt
}

export const generateShellPrompt = (): string => {
  const shell = execSync('echo $SHELL').toString().trim()
  const os = execSync('echo $OSTYPE').toString().trim()
  return `Generate an executable ${shell} script that works on ${os}. Try to make it a single line if possible and as simple and straightforward as possible.

Do not add any commentary or context to the message other than the commit message itself.

An example of the output for this should look like the following:

\`\`\`sh
find . -type f -name "*.ts" -exec sed -i '' 's/old/new/g' {} +
\`\`\`

Don't use that script, it is only an example.`
}

export const collectSpecialFileContents = (): Record<string, string | Record<string, unknown>> => {
  const specialFileContents: Record<string, string | Record<string, unknown>> = {}
  for (const file of SPECIAL_FILES) {
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

export const checkForSpecialFiles = (): boolean => SPECIAL_FILES.some((file) => fs.existsSync(file))

export const getAllFilesInDirectory = async (dir: string): Promise<string[]> => {
  const subdirs = await fs.promises.readdir(dir)
  const files = await Promise.all(
    subdirs.map(async (subdir) => {
      const res = path.resolve(dir, subdir)
      if (subdir === 'node_modules' || subdir === '.git' || subdir === '.DS_Store') {
        return []
      }
      const stat = await fs.promises.stat(res)
      if (stat.isDirectory()) {
        return getAllFilesInDirectory(res)
      } else {
        const isBinary = await isBinaryFile(res)
        return isBinary ? [] : res
      }
    }),
  )
  return files.flat()
}

export const generateFileList = async (): Promise<string[]> => {
  try {
    const lsOutput = await runCommand('ls', [])
    const findOutput = await runCommand('find', ['.'])
    const cleanedFindOutput = findOutput.map((file) =>
      file.startsWith('./') ? file.slice(2) : file,
    )
    const files = [...lsOutput, ...cleanedFindOutput]
    const uniqueFiles = Array.from(new Set(files))
    return uniqueFiles.filter(
      (file) =>
        file && !file.includes('.git') && !file.includes('node_modules') && !file.includes('tmp'),
    )
  } catch (error) {
    console.error('Error generating file list:', (error as Error).message)
    return []
  }
}

export const runCommand = (command: string, args: string[]): Promise<string[]> => {
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

export const fetchModels = async (): Promise<string[]> => {
  try {
    const modelsOutput = await runCommand('cloving', ['models'])
    return modelsOutput
  } catch (error) {
    console.error('Error fetching models:', (error as Error).message)
    return []
  }
}

export const readFileContent = (file: string): string => {
  try {
    return fs.readFileSync(file, 'utf-8')
  } catch (error) {
    console.error('Error reading file content:', (error as Error).message)
    return ''
  }
}

const addFileToContext = async (
  filePath: string,
  contextFiles: Record<string, string>,
  baseDir: string,
): Promise<void> => {
  const relativePath = path.relative(baseDir, filePath)
  if (await isBinaryFile(filePath)) {
    return
  }
  const content = await fs.promises.readFile(filePath, 'utf-8')
  contextFiles[relativePath] = content
}

const addDirectoryToContext = async (
  dirPath: string,
  contextFiles: Record<string, string>,
  baseDir: string,
): Promise<void> => {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        await addDirectoryToContext(fullPath, contextFiles, baseDir)
      }
    } else {
      await addFileToContext(fullPath, contextFiles, baseDir)
    }
  }
}

export const addFileOrDirectoryToContext = async (
  contextFile: string,
  contextFiles: Record<string, string>,
  options: Record<string, any>,
): Promise<Record<string, string>> => {
  const filePath = path.resolve(contextFile)
  const baseDir = process.cwd()

  try {
    const stats = await fs.promises.stat(filePath)
    if (stats.isDirectory()) {
      await addDirectoryToContext(filePath, contextFiles, baseDir)
    } else if (stats.isFile()) {
      await addFileToContext(filePath, contextFiles, baseDir)
    }
  } catch (error) {
    console.error(
      colors.red(`${colors.bold('Error')}: File or directory "${contextFile}" does not exist`),
    )
    process.exit(1)
  }

  return contextFiles
}
