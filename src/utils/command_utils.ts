import { spawn } from 'child_process'
import readline from 'readline'
import fs from 'fs'

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
  'cabal.project',
  'Project.toml',
  'rockspec',
  'rebar.config',
  'project.clj'
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

export const checkForSpecialFiles = (): boolean => {
  return SPECIAL_FILES.some(file => fs.existsSync(file))
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

export const promptUser = (question: string): Promise<string> => {
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

export const fetchModels = async (): Promise<string[]> => {
  try {
    const modelsOutput = await runCommand('cloving', ['models'])
    return modelsOutput
  } catch (error) {
    console.error('Error fetching models:', (error as Error).message)
    return []
  }
}