import highlight from 'cli-highlight'
import ncp from 'copy-paste'
import fs from 'fs'
import path from 'path'
import { input, confirm } from '@inquirer/prompts'

import { collectSpecialFileContents, addFileOrDirectoryToContext } from '../../utils/prompt_utils'
import { getConfig, getNearestClovingConfig, getAllFiles } from '../../utils/config_utils'
import type { ClovingGPTOptions } from '../../utils/types'

const generateContextPrompt = (files: string[], contextFiles: Record<string, string>): string => {
  const specialFileContents = collectSpecialFileContents()
  const specialFiles = Object.keys(specialFileContents)
    .map(
      (file) =>
        `### Contents of ${file}\n\n${JSON.stringify(specialFileContents[file], null, 2)}\n\n`,
    )
    .join('\n')
  const contextFileContents = Object.keys(contextFiles)
    .map((file) => `### Contents of ${file}\n\n${contextFiles[file]}\n\n`)
    .join('\n')

  return `### Description of App

${JSON.stringify(getNearestClovingConfig().config, null, 2)}

${specialFiles}

${contextFileContents}

### Directory structure

${files.join('\n')}`
}

const context = async (options: ClovingGPTOptions) => {
  let { files } = options
  options.silent = getConfig(options).globalSilent || false
  const allSrcFiles = await getAllFiles(options, false)
  let contextFiles: Record<string, string> = {}

  try {
    if (files) {
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
    } else {
      let includeMoreFiles = true

      while (includeMoreFiles) {
        const contextFile = await input({
          message:
            'Enter the relative path of a file or directory you would like to include as context (or press enter to continue):',
        })

        if (contextFile) {
          contextFiles = await addFileOrDirectoryToContext(contextFile, contextFiles, options)
        } else {
          includeMoreFiles = false
        }
      }
    }

    const contextPrompt = generateContextPrompt(allSrcFiles, contextFiles)

    console.log('\nGenerated Context Prompt:')
    console.log(highlight(contextPrompt, { language: 'markdown' }))

    const copyToClipboard = await confirm({
      message: 'Do you want to copy the context prompt to your clipboard?',
      default: true,
    })

    if (copyToClipboard) {
      ncp.copy(contextPrompt, () => {
        console.log('Context prompt copied to clipboard')
      })
    }
  } catch (error) {
    console.error('Could not generate context', error)
  }
}

export default context
