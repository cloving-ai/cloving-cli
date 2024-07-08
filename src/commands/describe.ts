import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getModel } from '../utils/model_utils'

// Function to estimate token count
export const estimateTokens = async (text: string): Promise<number> => {
  const charCount = text.length
  const tokenCount = Math.ceil(charCount / 4)
  return tokenCount
}

// Function to extract JSON metadata from the AI response
export const extractJsonMetadata = (response: string): string | null => {
  const jsonBlockStart = response.indexOf('```json')
  const jsonBlockEnd = response.indexOf('```', jsonBlockStart + 6)

  if (jsonBlockStart !== -1 && jsonBlockEnd !== -1) {
    const jsonString = response.substring(jsonBlockStart + 6, jsonBlockEnd).trim()

    // Remove any data before the first '{'
    const jsonStartIndex = jsonString.indexOf('{')
    if (jsonStartIndex !== -1) {
      return jsonString.substring(jsonStartIndex)
    }
  }

  return null
}

// Main function for the describe command
export const describe = async () => {
  // Generate a temporary file path
  const tempFilePath = path.join(os.tmpdir(), `describe_${Date.now()}.tmp`)

  try {
    // Generate the file list excluding .git and node_modules with increased buffer size
    const fileList = execFileSync('sh', ['-c', 'find . | grep -v .git | grep -v node_modules'], { maxBuffer: 10 * 1024 * 1024 }).toString().trim().split('\n')

    // Limit the file list to the first 100 files
    const limitedFileList = fileList.slice(0, 100)

    // Include package.json content if it exists
    let packageJson = {} as Record<string, unknown> | string
    if (fs.existsSync('package.json')) {
      try {
        packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
      } catch (error) {
        packageJson = fs.readFileSync('package.json', 'utf-8')
      }
    }

    // Include Gemfile content if it exists
    let gemfileContent = ''
    if (fs.existsSync('Gemfile')) {
      gemfileContent = fs.readFileSync('Gemfile', 'utf-8')
    }

    // Generate the JSON object for the AI chat model
    const projectDetails = {
      files: limitedFileList,
      packageJson,
      gemfile: gemfileContent || null
    }

    const prompt = `Here is a JSON object describing my project:
${JSON.stringify(projectDetails, null, 2)}

Please return JSON-formatted metadata about the project, including:
- The programming language(s) used
- The detected framework(s) (if any)
- The version of the language(s)`

    // Estimate and print token count if DEBUG=1
    if (process.env.DEBUG === '1') {
      const tokenCount = await estimateTokens(prompt)
      console.log(`Estimated token count: ${tokenCount}`)
    }

    // Get AI chat response and write to temporary file
    const aiChatResponse = execFileSync('aichat', ['-m', getModel(), '-r', 'coder', prompt]).toString()
    fs.writeFileSync(tempFilePath, aiChatResponse)

    // Extract JSON metadata from the AI response
    const jsonMetadata = extractJsonMetadata(aiChatResponse)
    if (jsonMetadata) {
      console.log(jsonMetadata)
    } else {
      console.log(aiChatResponse)
    }

    // Clean up
    fs.unlinkSync(tempFilePath)
  } catch (error) {
    console.error('Error describing the project:', (error as Error).message)
  }
}

export default describe
