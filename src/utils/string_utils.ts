import fs from 'fs'
import path from 'path'
import colors from 'colors'

import type { BlockIndices, CurrentNewBlock } from './types'

const BLOCK_START = '\n```'
const BLOCK_CURRENT = '\n<<<<<<< CURRENT'
const BLOCK_DIVIDER = '\n======='
const BLOCK_END = '\n>>>>>>> NEW\n```'

// Function to estimate token count
export const estimateTokens = async (text: string): Promise<number> => {
  const charCount = text.length
  const tokenCount = Math.ceil(charCount / 4)
  return tokenCount
}

/**
 * Extracts JSON metadata from an AI response string.
 *
 * This function attempts to extract a valid JSON string from the given response.
 * It handles responses that may contain the JSON within a code block or as plain text.
 *
 * The function performs the following steps:
 * 1. Looks for a ```json code block and extracts its content if found.
 * 2. If no code block is found, it treats the entire response as potential JSON.
 * 3. Trims the extracted string to remove leading/trailing whitespace.
 * 4. Removes any text before the first '{' and after the last '}'.
 *
 * @param {string} response - The AI response string that may contain JSON metadata.
 * @returns {string} A string containing only the JSON part of the response.
 *                   If no valid JSON structure is found, it may return an empty string
 *                   or a partial JSON string.
 *
 * @example
 * const aiResponse = '```json\n{"key": "value"}\n```\nOther text'
 * const jsonMetadata = extractJsonMetadata(aiResponse)
 * // jsonMetadata will be '{"key": "value"}'
 *
 * @example
 * const plainResponse = 'Some text {"key": "value"} more text'
 * const jsonMetadata = extractJsonMetadata(plainResponse)
 * // jsonMetadata will be '{"key": "value"}'
 */
export const extractJsonMetadata = (response: string): string => {
  let jsonString: string

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

  // sanity check that the extracted string is valid JSON
  try {
    JSON.parse(jsonString)
  } catch (error) {
    jsonString = ''
  }

  return jsonString
}

/**
 * Extracts markdown content from a given response string.
 *
 * This function attempts to extract markdown content from the input string,
 * focusing on content within code blocks and removing any surrounding metadata.
 *
 * @param {string} response - The input string containing markdown and possibly other content.
 * @returns {string} The extracted markdown content.
 *
 * @example
 * const response = '```markdown\n# Title\nContent\n```\nOther text';
 * const markdown = extractMarkdown(response);
 * console.log(markdown); // Outputs: "# Title\nContent"
 */
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

/**
 * Parses markdown instructions into separate blocks.
 *
 * This function takes a string input containing markdown instructions and
 * separates it into an array of strings, where each string represents a
 * distinct block of content (either a code block or a text block).
 *
 * @param {string} input - The input string containing markdown instructions.
 * @returns {string[]} An array of strings, each representing a distinct block of content.
 *
 * @example
 * const input = "# Title\n```js\nconst x = 1;\n```\nSome text";
 * const blocks = parseMarkdownInstructions(input);
 * console.log(blocks);
 * // Outputs: ["# Title", "```js\nconst x = 1;\n```", "Some text"]
 */
export const parseMarkdownInstructions = (input: string): string[] => {
  const lines = input.split('\n')
  const result: string[] = []
  let buffer: string[] = []
  let inCodeBlock = false

  lines.forEach((line) => {
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

/**
 * Finds the indices of a CURRENT/NEW block within the input string.
 *
 * This function searches for the start, divider, and end markers of a CURRENT/NEW block
 * in the input string, starting from the given index. It returns the indices of these
 * markers if a complete block is found.
 *
 * @param {string} input - The input string to search for block indices.
 * @param {number} startIndex - The index in the input string to start searching from.
 * @returns {BlockIndices | null} An object containing the indices of the block components,
 *                                or null if a complete block is not found.
 */
export const findBlockIndices = (input: string, startIndex: number): BlockIndices | null => {
  const blockStart = input.indexOf(BLOCK_START, startIndex)
  if (blockStart === -1) return null

  const languageStart = blockStart + BLOCK_START.length
  const languageEnd = input.indexOf('\n', languageStart)
  if (languageEnd === -1) return null

  const currentStart = input.indexOf(BLOCK_CURRENT, startIndex)
  const filePathStart = currentStart + BLOCK_CURRENT.length
  const filePathEnd = input.indexOf('\n', filePathStart)
  const dividerIndex = input.indexOf(BLOCK_DIVIDER, filePathEnd)
  if (dividerIndex === -1) return null

  const blockEnd = input.indexOf(BLOCK_END, dividerIndex)
  if (blockEnd === -1) return null

  return {
    start: languageStart,
    current: currentStart,
    filePathEnd,
    divider: dividerIndex,
    end: blockEnd,
  }
}

/**
 * Extracts the content of a CURRENT/NEW block using the provided indices.
 *
 * This function takes the input string and a set of block indices, and extracts
 * the file path, current content, and new content from the block.
 *
 * @param {string} input - The input string containing the CURRENT/NEW block.
 * @param {BlockIndices} indices - An object containing the indices of the block components.
 * @returns {CurrentNewBlock} An object containing the extracted file path, current content, and new content.
 */
export const extractBlock = (input: string, indices: BlockIndices): CurrentNewBlock => {
  const language = input.slice(indices.start, indices.current).trim()
  const filePath = input.slice(indices.current + BLOCK_CURRENT.length, indices.filePathEnd).trim()
  const currentContent = input.slice(indices.filePathEnd + 1, indices.divider).trim()
  const newContent = input.slice(indices.divider + BLOCK_DIVIDER.length, indices.end).trim()

  return { language, filePath, currentContent, newContent }
}

/**
 * Extracts CURRENT/NEW blocks from the given input string.
 *
 * This function parses the input string to find and extract all CURRENT/NEW blocks.
 * Each block contains information about file paths, current content, and new content.
 *
 * The blocks are defined by specific delimiters:
 * - Setup: '```lang'
 * - Start: '<<<<<<< CURRENT'
 * - Divider: '======='
 * - End: '>>>>>>> NEW'
 * - Finish: '```'
 *
 * @param {string} [input] - The input string containing CURRENT/NEW blocks.
 * @returns {CurrentNewBlock[]} An array of CurrentNewBlock objects, each representing a parsed block.
 *                              If the input is undefined or empty, an empty array is returned.
 *
 * @example
 * const input = "
 * ```typescript
 * <<<<<<< CURRENT path/to/file.ts
 * const oldCode = 'old'
 * =======
 * const newCode = 'new'
 * >>>>>>> NEW
 * ```"
 * const blocks = extractCurrentNewBlocks(input)
 * // blocks will contain one CurrentNewBlock object with the parsed information
 */

export const extractCurrentNewBlocks = (input?: string): CurrentNewBlock[] => {
  if (!input) return []

  const blocks: CurrentNewBlock[] = []
  let currentIndex = 0

  while (currentIndex < input.length) {
    const indices = findBlockIndices(input, currentIndex)
    if (!indices) break

    blocks.push(extractBlock(input, indices))
    currentIndex = indices.end + BLOCK_END.length
  }

  return blocks
}

const readFileContent = async (filePath: string): Promise<string> => {
  try {
    return await fs.promises.readFile(filePath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return ''
    }
    throw error
  }
}

export const ensureDirectoryExists = async (filePath: string): Promise<void> => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
}

export const writeFileContent = async (filePath: string, content: string): Promise<void> => {
  await ensureDirectoryExists(filePath)
  await fs.promises.writeFile(filePath, content)
}

/**
 * Updates the content of a file by replacing a specified block of current content with new content.
 *
 * This function searches for the `currentContent` within the `currentContent` of the file.
 * If found, it replaces it with the `newContent` from the `block`, preserving the indentation
 * level of the original content.
 *
 * @param {string} currentContent - The existing content of the file.
 * @param {CurrentNewBlock} block - An object containing the current and new content to be replaced.
 * @returns {string} The updated file content with the specified block replaced.
 *
 * @example
 * const currentContent = `
 * function example() {
 *   console.log('Old content')
 * }
 * `
 * const block = {
 *   currentContent: "console.log('Old content')",
 *   newContent: "console.log('New content')"
 * }
 * const updatedContent = searchReplaceString(currentContent, block)
 * // updatedContent will be:
 * // function example() {
 * //   console.log('New content')
 * // }
 */
export const searchReplaceString = (currentContent: string, block: CurrentNewBlock): string => {
  // 1) if block.currentContent.trim() is empty then return block.newContent
  if (block.currentContent.trim() === '') {
    return block.newContent
  }

  // check if you can replace the entire block without changing indentation
  if (currentContent.includes(block.currentContent)) {
    return currentContent.replace(block.currentContent, block.newContent)
  }

  // 2) split currentContent and block.currentContent into new lines and trim() all the lines, then put back the new lines
  const currentLines = currentContent.split('\n').map((line) => line.trim())
  const blockLines = block.currentContent.split('\n').map((line) => line.trim())

  // 3) see if the trimmed block.currentContent matches a section of code in the trimmed currentContent
  const blockContent = blockLines.join('\n')
  const currentContentTrimmed = currentLines.join('\n')

  // 4) if so, make a variable named matchingLine with the line number of which line the block.currentContent starts on in currentContent
  const matchingLine = currentContentTrimmed.indexOf(blockContent)
  if (matchingLine === -1) {
    return currentContent // If no match is found, return the original content
  }

  // 5) compare the first line of block.currentContent with the startLine line of currentContent, putting any preceeding spaces that are in currentContent but not in block.currentContent into a variable named preceedingSpaces
  const startLine = currentContent.split('\n').findIndex((line) => line.includes(blockLines[0]))
  if (startLine === -1) {
    return currentContent // If no match is found, return the original content
  }
  const startLineContent = currentContent.split('\n')[startLine]
  const blockLineContent = block.currentContent.split('\n')[0]
  const precedingSpaces = startLineContent.replace(blockLineContent, '')

  // 6) add preceedingSpaces to the start of each line in both block.currentContent and block.newContent
  if (precedingSpaces) {
    const indentedCurrentContent = block.currentContent
      .split('\n')
      .map((line) => precedingSpaces + line)
      .join('\n')
    const indentedNewContent = block.newContent
      .split('\n')
      .map((line) => precedingSpaces + line)
      .join('\n')
    // 7) finally, do a simple currentContent.replace(block.currentContent, block.newContent) with the modified (added preceeding spaces to match) variables
    return currentContent.replace(indentedCurrentContent, indentedNewContent)
  } else {
    return currentContent.replace(block.currentContent, block.newContent)
  }
}

/**
 * Analyzes the content of a block against the file content to find matching lines.
 *
 * This function compares the trimmed content of a block with the trimmed content of a file
 * to identify all occurrences of the block content within the file.
 *
 * @param {CurrentNewBlock} block - The block containing the content to be searched for.
 * @param {string} fileContent - The content of the file to be analyzed.
 * @returns {Promise<{ matchingLines: number[]; currentContentTrimmed: string }>} A promise that resolves to an object containing:
 *   - matchingLines: An array of line numbers where the block content matches in the file.
 *   - currentContentTrimmed: The trimmed content of the file.
 */
const analyzeBlockContent = async (
  block: CurrentNewBlock,
  fileContent: string,
): Promise<{ matchingLines: number[]; currentContentTrimmed: string }> => {
  const currentLines = fileContent.split('\n').map((line) => line.trim())
  const blockLines = block.currentContent.split('\n').map((line) => line.trim())

  const blockContent = blockLines.join('\n')
  const currentContentTrimmed = currentLines.join('\n')
  const matchingLines = []
  let matchingLine = -1

  while ((matchingLine = currentContentTrimmed.indexOf(blockContent, matchingLine + 1)) !== -1) {
    matchingLines.push(matchingLine)
  }

  return { matchingLines, currentContentTrimmed }
}

/**
 * Processes a single block by applying its changes to the corresponding file.
 *
 * This function handles the following scenarios:
 * 1. Creating a new file if it doesn't exist.
 * 2. Updating an existing file if the block's current content matches exactly once.
 * 3. Logging errors if the current content is not found or matches multiple times.
 *
 * @param {CurrentNewBlock} block - The block containing the changes to be applied.
 * @param {number} index - The index of the block being processed (used for logging).
 * @returns {Promise<void>} A promise that resolves when the block has been processed.
 */
export const applyAndSaveBlock = async (block: CurrentNewBlock, index: number): Promise<void> => {
  const filePath = path.resolve(block.filePath)
  let fileContent = await readFileContent(filePath)

  if (fileContent === '') {
    await writeFileContent(filePath, block.newContent)
    console.log(
      `[${index + 1}] ${colors.green.bold(block.filePath)} has been ${colors.green.bold('created')}`,
    )
    return
  }

  const { matchingLines } = await analyzeBlockContent(block, fileContent)

  if (matchingLines.length === 0) {
    console.log(
      `[${index + 1}] ${colors.red.bold(block.filePath)} ${colors.red.bold('ERROR: Current content not found to replace in the file')}`,
    )
    return
  } else if (matchingLines.length > 1) {
    console.log(
      `[${index + 1}] ${colors.red.bold(block.filePath)} ${colors.red.bold(`ERROR: Current content matches multiple (${matchingLines.length}) parts in the file`)}`,
    )
    return
  }

  const updatedContent = searchReplaceString(fileContent, block)
  await writeFileContent(filePath, updatedContent)
  console.log(
    `[${index + 1}] ${colors.green.bold(block.filePath)} has been ${colors.yellow.bold('updated')}`,
  )
}

/**
 * Applies and saves the changes specified in the CurrentNewBlock array.
 *
 * This function iterates through an array of CurrentNewBlock objects, each representing
 * a change to be made to a file. For each block, it attempts to process the change
 * by either creating a new file, updating an existing file, or reporting an error
 * if the current content doesn't match.
 *
 * The function provides console output to inform the user about the status of each
 * file operation (created, updated, or error).
 *
 * @param {CurrentNewBlock[]} blocks - An array of CurrentNewBlock objects representing the changes to be applied.
 * @returns {Promise<void>} A promise that resolves when all blocks have been processed.
 *
 * @throws Will log errors to the console if any block processing fails, but won't stop execution for other blocks.
 *
 * @example
 * const blocks = [
 *   { filePath: 'path/to/file.ts', currentContent: 'old code', newContent: 'new code' },
 *   { filePath: 'path/to/newfile.ts', currentContent: '', newContent: 'new file content' }
 * ]
 * await applyAndSaveCurrentNewBlocks(blocks)
 */
export const applyAndSaveCurrentNewBlocks = async (blocks: CurrentNewBlock[]): Promise<void> => {
  console.log(`\nApplying and saving current/new blocks...\n`)

  for (const [index, block] of blocks.entries()) {
    try {
      await applyAndSaveBlock(block, index)
    } catch (error) {
      console.error(`Error processing ${colors.red(block.filePath)}:`, error)
    }
  }
}

/**
 * Checks if all the blocks can be applied without making any changes.
 *
 * This function iterates through an array of CurrentNewBlock objects and checks
 * if each block can be applied to its respective file. It returns a tuple where
 * the first element is a boolean indicating if all blocks can be applied, and
 * the second element is a string summarizing the success or failure of each block.
 *
 * @param {CurrentNewBlock[]} blocks - An array of CurrentNewBlock objects to be checked.
 * @returns {Promise<[boolean, string]>} A promise that resolves to a tuple containing
 *                                       a boolean and a summary string.
 *
 * @example
 * const blocks = [
 *   { filePath: 'path/to/file.ts', currentContent: 'old code', newContent: 'new code' },
 *   { filePath: 'path/to/newfile.ts', currentContent: '', newContent: 'new file content' }
 * ]
 * const [canApply, summary] = await checkBlocksApplicability(blocks)
 */
export const checkBlocksApplicability = async (
  blocks: CurrentNewBlock[],
): Promise<[boolean, string]> => {
  let allApplicable = true
  const summary: string[] = []

  for (const [index, block] of blocks.entries()) {
    const filePath = path.resolve(block.filePath)
    let fileContent = await readFileContent(filePath)

    if (block.newContent.trim() === '') {
      allApplicable = false
      summary.push(
        `[${index + 1}] ${colors.red.bold(block.filePath)} ${colors.red.bold('cannot be applied: New content is empty')}`,
      )
    } else if (fileContent === '') {
      summary.push(
        `[${index + 1}] ${colors.green.bold(block.filePath)} can be ${colors.green.bold('created')}`,
      )
    } else if (block.currentContent.trim() === '') {
      allApplicable = false
      summary.push(
        `[${index + 1}] ${colors.red.bold(block.filePath)} ${colors.red.bold(`cannot be applied: File '${block.filePath}' already exists`)}`,
      )
    } else {
      const { matchingLines } = await analyzeBlockContent(block, fileContent)

      if (matchingLines.length === 0) {
        allApplicable = false
        summary.push(
          `[${index + 1}] ${colors.red.bold(block.filePath)} ${colors.red.bold('cannot be applied: Current content not found')}`,
        )
      } else if (matchingLines.length > 1) {
        allApplicable = false
        summary.push(
          `[${index + 1}] ${colors.red.bold(block.filePath)} ${colors.red.bold(`cannot be applied: Current content matches multiple (${matchingLines.length}) parts in the file`)}`,
        )
      } else {
        summary.push(
          `[${index + 1}] ${colors.green.bold(block.filePath)} can be ${colors.yellow.bold('updated')}`,
        )
      }
    }
  }

  return [allApplicable, summary.join('\n')]
}
