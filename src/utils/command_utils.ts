import { spawn, execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getAllFiles } from './config_utils'

export const SPECIAL_FILES = [
  'package.json', 'Gemfile', 'requirements.txt', 'Pipfile', 'pyproject.toml', 'pom.xml', 'build.gradle',
  '.csproj', 'packages.config', 'composer.json', 'CMakeLists.txt', 'conanfile.txt', 'conanfile.py',
  'go.mod', 'Cargo.toml', 'Package.swift', 'build.gradle.kts', 'Podfile', 'Cartfile', 'cpanfile',
  'DESCRIPTION', 'mix.exs', 'build.sbt', 'pubspec.yaml', 'stack.yaml', 'cabal.project', 'Project.toml',
  'rockspec', 'rebar.config', 'project.clj'
]

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
