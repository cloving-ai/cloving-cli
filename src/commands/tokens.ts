import fs from 'fs'
import path from 'path'
import { getClovingConfig } from '../utils/config_utils'
import { getAllFilesInDirectory } from '../utils/command_utils'
import type { ClovingGPTOptions } from '../utils/types'

const tokens = async (options: ClovingGPTOptions) => {
  let contextFiles: Record<string, string> = {}
  let files = options.files || '.'

  let prompt = ''

  let expandedFiles: string[] = []
  for (const file of files) {
    const filePath = path.resolve(file)
    if (await fs.promises.stat(filePath).then(stat => stat.isDirectory()).catch(() => false)) {
      const dirFiles = await getAllFilesInDirectory(filePath)
      expandedFiles = expandedFiles.concat(dirFiles.map(f => path.relative(process.cwd(), f)))
    } else {
      expandedFiles.push(path.relative(process.cwd(), filePath))
    }
  }
  files = expandedFiles

  for (const file of files) {
    const filePath = path.resolve(file)
    if (await fs.promises.stat(filePath).then(stat => stat.isFile()).catch(() => false)) {
      const content = await fs.promises.readFile(filePath, 'utf-8')
      contextFiles[file] = content
    }
  }

  const contextFileContents = Object.keys(contextFiles).map((file) => `### Contents of ${file}\n\n${contextFiles[file]}\n\n`).join('\n')
  prompt += `
### Description of App

${JSON.stringify(getClovingConfig(), null, 2)}

${contextFileContents}`


  const tokens = Math.ceil(prompt.length / 4).toLocaleString()
  console.log(`Estimated tokens: ${tokens}`)
}

export default tokens