/**
 * @module tokens
 * This module provides functionality to estimate the number of tokens in the context files
 * and project description for GPT processing.
 */

import fs from 'fs'
import path from 'path'
import { getNearestClovingConfig } from '../utils/config_utils'
import { getAllFilesInDirectory } from '../utils/prompt_utils'
import type { ClovingGPTOptions } from '../utils/types'

/**
 * Calculates the estimated number of tokens for the given context files and project description.
 * @param {ClovingGPTOptions} options - The options for token calculation, including file paths.
 * @returns {Promise<void>} A promise that resolves when the token estimation is complete.
 */
const tokens = async (options: ClovingGPTOptions): Promise<void> => {
  let contextFiles: Record<string, string> = {}
  let files = options.files || '.'

  let prompt = ''

  /**
   * Expands the given file paths to include all files in directories.
   * @type {string[]}
   */
  let expandedFiles: string[] = []
  for (const file of files) {
    const filePath = path.resolve(file)
    if (
      await fs.promises
        .stat(filePath)
        .then((stat) => stat.isDirectory())
        .catch(() => false)
    ) {
      const dirFiles = await getAllFilesInDirectory(filePath)
      expandedFiles = expandedFiles.concat(dirFiles.map((f) => path.relative(process.cwd(), f)))
    } else {
      expandedFiles.push(path.relative(process.cwd(), filePath))
    }
  }
  files = expandedFiles

  /**
   * Reads the content of each file and stores it in the contextFiles object.
   */
  for (const file of files) {
    const filePath = path.resolve(file)
    if (
      await fs.promises
        .stat(filePath)
        .then((stat) => stat.isFile())
        .catch(() => false)
    ) {
      const content = await fs.promises.readFile(filePath, 'utf-8')
      contextFiles[file] = content
    }
  }

  /**
   * Generates the prompt content by combining the app description and context file contents.
   */
  const contextFileContents = Object.keys(contextFiles)
    .map((file) => `### Contents of ${file}\n\n${contextFiles[file]}\n\n`)
    .join('\n')
  prompt += `
### Description of App

${JSON.stringify(getNearestClovingConfig().config, null, 2)}

${contextFileContents}`

  /**
   * Estimates the number of tokens based on the prompt length.
   * This is a rough estimation and may not be exact.
   */
  const tokens = Math.ceil(prompt.length / 4).toLocaleString()
  console.log(`Estimated tokens: ${tokens}`)
}

export default tokens
