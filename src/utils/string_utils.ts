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

export const extractFilesAndContent = (rawCodeCommand: string | undefined): Record<string, string> => {
  if (!rawCodeCommand) return {}
  const files: string[] = []
  const fileContents: Record<string, string> = {}

  let currentIndex = 0
  const commandLength = rawCodeCommand.length

  while (currentIndex < commandLength) {
    let fileNameStart = rawCodeCommand.indexOf('**', currentIndex)
    if (fileNameStart === -1) break

    let fileNameEnd = rawCodeCommand.indexOf('**', fileNameStart + 2)
    if (fileNameEnd === -1) break

    let nextBoldStart = rawCodeCommand.indexOf('**', fileNameEnd + 2)
    let nextCodeStart = rawCodeCommand.indexOf('\n```', fileNameEnd + 2)

    while (nextBoldStart !== -1 && nextCodeStart > nextBoldStart) {
      fileNameStart = nextBoldStart
      fileNameEnd = rawCodeCommand.indexOf('**', fileNameStart + 2)

      nextBoldStart = rawCodeCommand.indexOf('**', fileNameEnd + 2)
      nextCodeStart = rawCodeCommand.indexOf('\n```', fileNameEnd + 2)
    }

    const fileName = rawCodeCommand.slice(fileNameStart + 2, fileNameEnd).trim()
    files.push(fileName)

    const codeBlockStart = rawCodeCommand.indexOf('\n```', fileNameEnd)
    if (codeBlockStart === -1) break

    let codeBlockEnd = codeBlockStart + 4
    while (codeBlockEnd < commandLength) {
      if (rawCodeCommand.slice(codeBlockEnd, codeBlockEnd + 5) === '\n```\n') {
        break
      } else if (rawCodeCommand.slice(codeBlockEnd, codeBlockEnd + 4) === '\n```' && codeBlockEnd + 4 === commandLength) {
        break
      }
      codeBlockEnd++
    }

    if (codeBlockEnd >= commandLength) break

    let content = rawCodeCommand.slice(codeBlockStart + 4, codeBlockEnd).trim()

    const firstNewlineIndex = content.indexOf('\n')
    if (firstNewlineIndex !== -1) {
      content = content.slice(firstNewlineIndex + 1)
    } else {
      content = content.replace(/^\w+\s*/, '')
    }

    fileContents[fileName] = content.trim()

    currentIndex = codeBlockEnd + 5
  }

  return fileContents
}

export const saveGeneratedFiles = async (fileContents: Record<string, string>): Promise<void> => {
  for (const file of Object.keys(fileContents)) {
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
