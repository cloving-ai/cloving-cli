import fs from 'fs'
import path from 'path'
import { execSync, spawn } from 'child_process'
import { isBinaryFile } from 'isbinaryfile'

import { getAllFiles, getClovingConfig } from './config_utils'

export const SPECIAL_FILES = [
  'package.json', 'Gemfile', 'requirements.txt', 'Pipfile', 'pyproject.toml', 'pom.xml', 'build.gradle',
  '.csproj', 'packages.config', 'composer.json', 'CMakeLists.txt', 'conanfile.txt', 'conanfile.py',
  'go.mod', 'Cargo.toml', 'Package.swift', 'build.gradle.kts', 'Podfile', 'Cartfile', 'cpanfile',
  'DESCRIPTION', 'mix.exs', 'build.sbt', 'pubspec.yaml', 'stack.yaml', 'cabal.project', 'Project.toml',
  'rockspec', 'rebar.config', 'project.clj', 'tsconfig.json'
]

export const generateCodegenPrompt = (contextFilesContent: Record<string, string>): string => {
  const specialFileContents = collectSpecialFileContents()
  const specialFiles = Object.keys(specialFileContents).map((file) => `## Contents of ${file}\n\n${JSON.stringify(specialFileContents[file], null, 2)}\n\n`).join('\n')
  const contextFileContents = Object.keys(contextFilesContent).map((file) => `## Contents of ${file}\n\n${contextFilesContent[file]}\n\n`).join('\n')

  const prompt = `## Description of App

${JSON.stringify(getClovingConfig(), null, 2)}

${specialFiles}

${contextFileContents}

## Directory structure

${Object.keys(contextFilesContent).join('\n')}

## Instructions

Respond as an expert software developer and always follow best practices when coding. Adhere to existing conventions and libraries in the codebase.

Take requests for changes to the supplied code. If the request is unclear, ask questions.

Always reply to the user in the same programming language they are using.

Once you understand the request, you MUST:

1. Decide if you need to propose *CURRENT/NEW* Block edits to any files not already added to the chat. You can create new files without asking. But if you need to propose edits to existing files not already added to the chat, you MUST tell the user their full path names and ask them to add the files to the chat. End your reply and wait for their approval. You can keep asking if you then decide you need to edit more files.
2. Think step-by-step and explain the needed changes with a numbered list of short sentences.
3. Describe each change with a *CURRENT/NEW* Block per the examples below. ONLY EVER RETURN CODE IN A *CURRENT/NEW* BLOCK!

All changes to files must use the *CURRENT/NEW* Block format.

## *CURRENT/NEW* Block Rules

Every *CURRENT/NEW* Block must follow all of these rules:

1. Start a *CURRENT/NEW* Block with three backticks and the code's programming language name, eg: \`\`\`typescript
2. On the next line, there should be with seven < chars, then the word CURRENT in capitals, and finally the file path alone at the end of the line, eg: <<<<<<< CURRENT path/to/file.ts
4. Then there should be a contiguous chunk of code with the spaces and newlines intact from the original source
5. Put a single dividing line of seven = chars, eg: =======
6. The code lines to replace into the source code, with the spaces at the beginning and end of the block matching the original source code
7. The end of the *CURRENT/NEW* Block with seven > and the word NEW in capitals: >>>>>>> NEW
8. Finally close the *CURRENT/NEW* Block with just three backticks on its own line: \`\`\`
9. Every *CURRENT* area must *EXACTLY MATCH* the existing source code, character for character, space for space, including all comments, docstrings, etc.
10. Every *CURRENT* area must include the code that will change and a few lines around it if needed for uniqueness, you only need to show a few lines of unique code, not an entire function
11. To move code, make two *CURRENT/NEW* blocks, one to remove the code from the old location and one to add it to the new location
12. If you need to add code, the *CURRENT* block will be empty, and the *NEW* block will contain the new code with a file path to the full path of the new file, including the directory and file name
13. Code should only use *CURRENT/NEW* Blocks, never show code without them

## Examples of *CURRENT/NEW* Blocks

### Example 1: Changing a Variable

\`\`\`typescript
<<<<<<< CURRENT path/to/file.ts
const oldVariable = 1
=======
const newVariable = 2
>>>>>>> NEW
\`\`\`

### Example 2: Adding a New File

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
  System.out.println("Old function");
}
=======
>>>>>>> NEW
\`\`\``
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

export const checkForSpecialFiles = (): boolean => SPECIAL_FILES.some(file => fs.existsSync(file))

export const getAllFilesInDirectory = async (dir: string): Promise<string[]> => {
  const subdirs = await fs.promises.readdir(dir)
  const files = await Promise.all(subdirs.map(async (subdir) => {
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
  }))
  return files.flat()
}

export const generateFileList = async (): Promise<string[]> => {
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

export const addFileOrDirectoryToContext = async (
  contextFile: string,
  contextFiles: Record<string, string>,
  options: Record<string, any>
): Promise<Record<string, string>> => {
  const filePath = path.resolve(contextFile)
  if (await fs.promises.stat(filePath).then(stat => stat.isDirectory()).catch(() => false)) {
    // Add all files in the specified directory
    const files = await getAllFiles(options, false)
    for (const file of files) {
      // if the file is in the same directory as the context file, add it to the context
      if (path.dirname(file) === path.dirname(filePath)) {
        const content = await fs.promises.readFile(file, 'utf-8')
        contextFiles[path.relative(process.cwd(), file)] = content
      }
    }
    console.log(`Added contents of ${contextFile} to context.`)
  } else if (await fs.promises.stat(filePath).then(stat => stat.isFile()).catch(() => false)) {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    contextFiles[contextFile] = content
    console.log(`Added ${filePath} to context.`)
  } else {
    console.log(`File or directory ${contextFile} does not exist.`)
  }
  return contextFiles
}
