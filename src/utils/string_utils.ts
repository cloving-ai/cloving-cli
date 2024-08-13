import fs from 'fs'
import path from 'path'

import type { CurrentNewBlock } from './types'

// Function to estimate token count
export const estimateTokens = async (text: string): Promise<number> => {
  const charCount = text.length
  const tokenCount = Math.ceil(charCount / 4)
  return tokenCount
}

// Function to extract JSON metadata from the AI response
export const extractJsonMetadata = (response: string): string => {
  let jsonString

  // Extract the ```json block from the response
  const jsonBlockStart = response.indexOf('```json')
  const jsonBlockEnd = response.indexOf('```', jsonBlockStart + 6)

  if (jsonBlockStart !== -1 && jsonBlockEnd !== -1) {
    jsonString = response.substring(jsonBlockStart + 6, jsonBlockEnd).trim()
  } else {
    jsonString = response
  }

  // Remove any data before the first '{'
  const jsonStartIndex = jsonString.indexOf('{')
  if (jsonStartIndex !== -1) {
    jsonString = jsonString.substring(jsonStartIndex)
  }

  // Remove any data after the last '}'
  const jsonEndIndex = jsonString.lastIndexOf('}')
  if (jsonEndIndex !== -1) {
    jsonString = jsonString.substring(0, jsonEndIndex + 1)
  }

  return jsonString
}

// Function to extract markdown from the AI response
export const extractMarkdown = (response: string): string => {
  let markdownString = response

  // Regular expression to match any ```<word> block
  const codeBlockRegex = /```(\w+)\s*([\s\S]*?)\s*```/g

  let match
  while ((match = codeBlockRegex.exec(response)) !== null) {
    // Extract the content inside the code block
    const [, , content] = match
    markdownString = content.trim()
  }

  // Remove any data before the first '#'
  const jsonStartIndex = markdownString.indexOf('#')
  if (jsonStartIndex !== -1) {
    markdownString = markdownString.substring(jsonStartIndex)
  }

  // Remove the last ``` if it exists
  if (markdownString.endsWith('```')) {
    markdownString = markdownString.substring(0, markdownString.length - 3)
  }

  return markdownString
}

export const parseMarkdownInstructions = (input: string): string[] => {
  const lines = input.split('\n')
  const result: string[] = []
  let buffer: string[] = []
  let inCodeBlock = false

  lines.forEach(line => {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        buffer.push(line)
        result.push(buffer.join('\n'))
        buffer = []
        inCodeBlock = false
      } else {
        // Start of code block
        if (buffer.length > 0) {
          result.push(buffer.join('\n'))
          buffer = []
        }
        buffer.push(line)
        inCodeBlock = true
      }
    } else {
      buffer.push(line)
    }
  })

  // If buffer has any remaining lines, add them to the result
  if (buffer.length > 0) {
    result.push(buffer.join('\n'))
  }

  return result
}

export const extractCurrentNewBlocks = (input: string): CurrentNewBlock[] => {
  const blocks: CurrentNewBlock[] = []
  let currentIndex = 0
  const inputLength = input.length

  while (currentIndex < inputLength) {
    const blockStart = input.indexOf('<<<<<<< CURRENT', currentIndex)
    if (blockStart === -1) break

    const filePathStart = blockStart + '<<<<<<< CURRENT'.length
    const filePathEnd = input.indexOf('\n', filePathStart)
    const filePath = input.slice(filePathStart, filePathEnd).trim()

    const dividerIndex = input.indexOf('=======', filePathEnd)
    if (dividerIndex === -1) break

    const blockEnd = input.indexOf('>>>>>>> NEW', dividerIndex)
    if (blockEnd === -1) break

    const currentContent = input.slice(filePathEnd + 1, dividerIndex).trim()
    const newContent = input.slice(dividerIndex + '======='.length, blockEnd).trim()

    blocks.push({
      filePath,
      currentContent,
      newContent,
    })

    currentIndex = blockEnd + '>>>>>>> NEW'.length
  }

  return blocks
}

export const applyAndSaveCurrentNewBlocks = async (blocks: CurrentNewBlock[]): Promise<void> => {
  for (const block of blocks) {
    const filePath = path.resolve(block.filePath)

    try {
      // Read the current file content
      let fileContent = await fs.promises.readFile(filePath, 'utf-8')

      // Replace the current content with the new content
      if (block.currentContent.trim() === '') {
        fileContent = block.newContent
      } else {
        fileContent = fileContent.replace(block.currentContent, block.newContent)
      }

      console.log(`#### Updating ${block.filePath} #####`)
      console.log(fileContent)
      console.log('#### End of File #####')

      // Ensure the directory exists
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

      // Write the updated content back to the file
      await fs.promises.writeFile(filePath, fileContent)

      console.log(`${block.filePath} has been updated and saved.`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // If the file doesn't exist, create it with the new content
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
        await fs.promises.writeFile(filePath, block.newContent)
        console.log(`${block.filePath} has been created and saved.`)
      } else {
        console.error(`Error processing ${block.filePath}:`, error)
      }
    }
  }
}