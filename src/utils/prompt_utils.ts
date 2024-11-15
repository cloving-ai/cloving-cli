/**
 * @module prompt_utils
 * @description Provides utility functions for generating prompts, handling files, and running commands.
 */

import fs from 'fs'
import path from 'path'
import { execSync, spawn } from 'child_process'
import { isBinaryFile } from 'isbinaryfile'
import colors from 'colors'
import { join } from 'path'

import { getNearestClovingConfig } from './config_utils'
import {
  REVIEW_INSTRUCTIONS,
  DOCS_INSTRUCTIONS,
  CODEGEN_INSTRUCTIONS,
  SPECIAL_FILES,
  SHELL_INSTRUCTIONS,
  CODEGEN_EXAMPLES,
} from './prompts'

import type { ClovingGPTOptions } from './types'

/**
 * Retrieves the package version from package.json.
 * @returns {string} The version of the package.
 */
export const getPackageVersion = () => {
  const packagePath = join(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
  return packageJson.version
}

/**
 * Renders a context file as a string.
 * @param {Record<string, unknown> | string} contextFile - The context file to render.
 * @returns {string} The rendered string representation of the context file.
 */
const renderAsString = (contextFile: Record<string, unknown> | string): string => {
  if (typeof contextFile === 'string') {
    return contextFile
  }
  return JSON.stringify(contextFile, null, 2)
}

/**
 * Generates a prompt for code generation based on context files and special files.
 * @param {Record<string, string>} contextFilesContent - The content of context files.
 * @returns {string} The generated prompt for code generation.
 */
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
${JSON.stringify(getNearestClovingConfig().config, null, 2)}
\`\`\`

## Special Files

${specialFiles.length > 0 ? specialFiles : 'No special files provided.'}

## Context Files

${contextFileContents.length > 0 ? contextFileContents : 'No context files provided.'}

## Directory structure

${Object.keys(contextFilesContent).join('\n')}

${CODEGEN_INSTRUCTIONS}

${CODEGEN_EXAMPLES}`
  return prompt
}

/**
 * Generates a prompt for documentation generation based on context files and special files.
 * @param {Record<string, string>} contextFilesContent - The content of context files.
 * @returns {string} The generated prompt for documentation generation.
 */
export const generateDocsPrompt = (contextFilesContent: Record<string, string>): string => {
  const specialFileContents = collectSpecialFileContents()
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

  const prompt = `${DOCS_INSTRUCTIONS}

${CODEGEN_INSTRUCTIONS}

${CODEGEN_EXAMPLES}

## Description of App

\`\`\`json
${JSON.stringify(getNearestClovingConfig().config, null, 2)}
\`\`\`

## Special Files

${specialFiles.length > 0 ? specialFiles : 'No special files provided.'}

## Context Files

${contextFileContents.length > 0 ? contextFileContents : 'No context files provided.'}

## Directory structure

${Object.keys(contextFilesContent).join('\n')}

${DOCS_INSTRUCTIONS}`

  return prompt
}

/**
 * Generates a prompt for shell commands based on the current shell and OS.
 * @returns {string} The generated prompt for shell commands.
 */
export const generateShellPrompt = (): string => {
  const shell = execSync('echo $SHELL').toString().trim()
  const os = execSync('echo $OSTYPE').toString().trim()
  return `${SHELL_INSTRUCTIONS}\n\n## Context\n\nShell: ${shell}\n\nOS: ${os}`
}

export const generateReviewPrompt = (
  options: ClovingGPTOptions,
  contextFiles: Record<string, string>,
): string => {
  let prompt = `${REVIEW_INSTRUCTIONS}`
  if (options.files) {
    const contextFileContents = Object.keys(contextFiles)
      .map((file) => `### Contents of ${file}\n\n${contextFiles[file]}\n\n`)
      .join('\n')

    prompt += `### Description of App

${JSON.stringify(getNearestClovingConfig().config, null, 2)}

${contextFileContents}

### Request

I would like you to explain the code and document a description of it.
List any bugs in the new code as well as recommended fixes for those bugs with code examples.
Format the output of this code review in Markdown format.`
  } else {
    prompt += `### Request

Do not use any data from the example response structure, only use the structure.
I would like you to explain why these change are being made and document a description of these changes.
Also list any bugs in the new code as well as recommended fixes for those bugs with code examples.
Format the output of this code review in Markdown format.`
  }

  return prompt
}

/**
 * Collects the contents of special files.
 * @returns {Record<string, string | Record<string, unknown>>} An object containing the contents of special files.
 */
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

/**
 * Checks if any special files exist in the current directory.
 * @returns {boolean} True if any special files exist, false otherwise.
 */
export const checkForSpecialFiles = (): boolean => SPECIAL_FILES.some((file) => fs.existsSync(file))

/**
 * Recursively gets all non-binary files in a directory.
 * @param {string} dir - The directory to search.
 * @returns {Promise<string[]>} A promise that resolves with an array of file paths.
 */
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

/**
 * Generates a list of files in the current directory and its subdirectories.
 * @returns {Promise<string[]>} A promise that resolves with an array of file paths.
 */
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

/**
 * Runs a shell command and returns its output.
 * @param {string} command - The command to run.
 * @param {string[]} args - The arguments for the command.
 * @returns {Promise<string[]>} A promise that resolves with an array of output lines.
 */
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

/**
 * Fetches available models using the 'cloving models' command.
 * @returns {Promise<string[]>} A promise that resolves with an array of available models.
 */
export const fetchModels = async (): Promise<string[]> => {
  try {
    const modelsOutput = await runCommand('cloving', ['models'])
    return modelsOutput
  } catch (error) {
    console.error('Error fetching models:', (error as Error).message)
    return []
  }
}

/**
 * Reads the content of a file.
 * @param {string} file - The path to the file.
 * @returns {string} The content of the file.
 */
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

/**
 * Adds a file or directory to the context.
 * @param {string} contextFile - The path to the file or directory to add.
 * @param {Record<string, string>} contextFiles - The current context files.
 * @param {Record<string, any>} options - Additional options.
 * @returns {Promise<Record<string, string>>} A promise that resolves with the updated context files.
 */
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
