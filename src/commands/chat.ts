import ncp from 'copy-paste'
import path from 'path'
import fs from 'fs'
import readline from 'readline'
import { execFileSync, execSync } from 'child_process'

import ClovingGPT from '../cloving_gpt'
import { generateCommitMessagePrompt } from '../utils/git_utils'
import { extractFilesAndContent, saveGeneratedFiles, extractMarkdown } from '../utils/string_utils'
import { getAllFilesInDirectory } from '../utils/command_utils'
import type { ClovingGPTOptions } from '../utils/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const repl = async (options: ClovingGPTOptions) => {
  options.silent = true
  options.stream = true
  const gpt = new ClovingGPT(options)

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'cloving> '
  })

  console.log('Welcome to Cloving REPL. Type "exit" to quit.')
  rl.prompt()

  let chatHistory: ChatMessage[] = []

  rl.on('line', async (line) => {
    const trimmedLine = line.trim().toLowerCase()

    if (trimmedLine === 'exit') {
      rl.close()
      return
    }

    if (trimmedLine === 'copy') {
      const lastResponse = chatHistory.filter(msg => msg.role === 'assistant').pop()
      if (lastResponse) {
        ncp.copy(lastResponse.content, () => {
          console.log('Last response copied to clipboard.')
          rl.prompt()
        })
      } else {
        console.log('No response to copy.')
        rl.prompt()
      }
      return
    }

    if (trimmedLine === 'save') {
      const lastResponse = chatHistory.filter(msg => msg.role === 'assistant').pop()
      if (lastResponse) {
        const [files, fileContents] = extractFilesAndContent(lastResponse.content)
        if (files.length > 0) {
          await saveGeneratedFiles(files, fileContents)
          console.log('Files have been saved.')
        } else {
          console.log('No files found to save in the last response.')
        }
      } else {
        console.log('No response to save files from.')
      }
      rl.prompt()
      return
    }

    if (trimmedLine === 'commit') {
      const diff = execSync('git diff HEAD').toString().trim()

      // Check if the diff is blank
      if (!diff) {
        console.error('No changes to commit.')
        return
      }

      // Generate the prompt for commit message
      const prompt = generateCommitMessagePrompt(diff)

      // Instantiate ClovingGPT and get the commit message
      gpt.stream = false
      const rawCommitMessage = await gpt.generateText({ prompt })
      gpt.stream = true

      // Clean the commit message using extractMarkdown
      const commitMessage = extractMarkdown(rawCommitMessage)

      // Write the commit message to a temporary file
      const tempCommitFilePath = path.join('.git', 'SUGGESTED_COMMIT_EDITMSG')
      fs.writeFileSync(tempCommitFilePath, commitMessage)

      // Commit the changes using the generated commit message
      try {
        execFileSync('git', ['commit', '-a', '--edit', '--file', tempCommitFilePath], { stdio: 'inherit' })
      } catch (commitError) {
        // If commit is canceled (non-zero exit), handle it here
        console.log('Commit was canceled or failed.')
      }

      // Remove the temporary file using fs
      fs.unlink(tempCommitFilePath, (err) => {
        if (err) throw err
      })

      return
    }

    try {
      let contextFiles: Record<string, string> = {}
      let files = options.files || '.'

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

      // Add user message to chat history
      chatHistory.push({ role: 'user', content: line })

      const prompt = `### Chat History

${chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

${contextFileContents}

### Task

${chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}`

      const responseStream = await gpt.streamText({ prompt })

      let accumulatedContent = ''

      responseStream.data.on('data', (chunk: Buffer) => {
        const chunkString = chunk.toString()
        const lines = chunkString.split('\n')

        for (const line of lines) {
          if (line.trim().startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6))
              if (jsonData?.delta?.text) {
                const content = jsonData.delta.text
                process.stdout.write(content)
                accumulatedContent += content
              }
            } catch (error) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      })

      responseStream.data.on('end', () => {
        // Add assistant message to chat history
        chatHistory.push({ role: 'assistant', content: accumulatedContent.trim() })
        rl.prompt()
      })

      responseStream.data.on('error', (error: Error) => {
        console.error('Error streaming response:', error)
        rl.prompt()
      })
    } catch (error) {
      console.error('Error processing request:', error)
      rl.prompt()
    }
  })

  rl.on('close', () => {
    console.log('Goodbye!')
    process.exit(0)
  })
}

export default repl
