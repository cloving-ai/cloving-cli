import fs from 'fs'
import path from 'path'

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

export const extractFilesAndContent = (rawCodeCommand: string | undefined): [string[], Record<string, string>] => {
  if (!rawCodeCommand) return [[], {}]
  const files: string[] = []
  const fileContents: Record<string, string> = {}

  const matches = rawCodeCommand.match(/(\*{2})([^\*]+)(\*{2})/g)
  if (!matches) return [files, fileContents]

  for (const match of matches) {
    const fileName = match.replace(/\*{2}/g, '').trim()
    const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\*\\*${escapedFileName}\\*\\*\\n\\n\\\`{3}([\\s\\S]+?)\\\`{3}`, 'g');
    const contentMatch = regex.exec(rawCodeCommand)
    if (contentMatch) {
      files.push(fileName)
      let content = contentMatch[1]

      // Remove the first word after the opening triple backticks
      content = content.split('\n').map((line, idx) => idx === 0 ? line.replace(/^\w+\s*/, '') : line).join('\n')

      fileContents[fileName] = content.trim()
    }
  }

  return [files, fileContents]
}

export const saveGeneratedFiles = async (files: string[], fileContents: Record<string, string>): Promise<void> => {
  for (const file of files) {
    if (fileContents[file]) {
      const filePath = path.resolve(file)
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
      await fs.promises.writeFile(filePath, fileContents[file])
      console.log(`${file} has been saved.`)
    } else {
      console.log(`File content not found for ${file}.`)
    }
  }
}
