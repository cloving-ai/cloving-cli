import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getGitDiff } from '../utils/git_utils'

// Function to estimate token count
const estimateTokens = (text: string): number => {
  const charCount = text.length
  const tokenCount = Math.ceil(charCount / 4)
  return tokenCount
}

// Main function for the unit_tests command
const unitTests = () => {
  // Generate a temporary file path
  const tempFilePath = path.join(os.tmpdir(), `unit_tests_${Date.now()}.tmp`)

  try {
    // Generate the prompt for the AI chat model
    const prompt = `Here is a list of all my model files:

==== begin list of models ====
${execSync('find app/models -type f').toString().trim()}
==== end list of models ====

Here is a list of all my test files:

==== begin list of test files ====
${execSync('find spec -type f').toString().trim()}
==== end list of test files ====

Please enumerate all the files in this git diff as well as the file names of any models that
this code interacts with. Also, list any test files that might be relevant to these changes:

==== begin git diff ====
${getGitDiff()}
==== end git diff ====

Give me this output format for your answer:

## files

app/models/foo.rb
app/views/baz/bar.html.erb

## interacted models

app/models/pop.rb

## relevant test files

test/models/foo_test.rb
test/controllers/baz_controller_test.rb`

    // Estimate and print token count
    let tokenCount = estimateTokens(prompt)
    console.log(`Estimated token count: ${tokenCount}`)

    // Get AI chat response and write to temporary file
    const aiChatResponse = execSync(`aichat "${prompt}"`).toString()
    fs.writeFileSync(tempFilePath, aiChatResponse)

    // Handle "files" argument
    if (process.argv.includes('files')) {
      console.log(aiChatResponse)
      fs.unlinkSync(tempFilePath)
      process.exit(0)
    }

    // Initialize variables
    const lines: string[] = []

    // Read input from temporary file
    const fileContent = fs.readFileSync(tempFilePath, 'utf-8')
    fileContent.split('\n').forEach((line) => {
      if (line.trim()) {
        lines.push(line.trim())
      }
    })

    // Generate output
    fs.writeFileSync(tempFilePath, '## files\n\n')

    lines.forEach((line) => {
      if (fs.existsSync(line) && fs.statSync(line).isFile()) {
        const fileContents = fs.readFileSync(line, 'utf-8')
        fs.appendFileSync(tempFilePath, `### **Contents of ${line}**\n\n${fileContents}\n\n`)
      }
    })

    // Handle "code" argument
    if (process.argv.includes('code')) {
      console.log(fs.readFileSync(tempFilePath, 'utf-8'))
      fs.unlinkSync(tempFilePath)
      process.exit(0)
    }

    // Generate the message for unit test creation
    const message = `please create unit tests for these changes:

${getGitDiff()}

## context

${fs.readFileSync(tempFilePath, 'utf-8')}`

    tokenCount = estimateTokens(message)
    console.log(`Estimated token count: ${tokenCount}`)

    // Clean up
    fs.unlinkSync(tempFilePath)

    // Print the output
    console.log(execSync(`echo "${message}" | aichat -m "$(model)" -r coder`).toString())
  } catch (error) {
    console.error('Error processing unit tests:', (error as Error).message)
  }
}

export default unitTests
