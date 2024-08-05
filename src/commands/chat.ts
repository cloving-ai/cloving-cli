import ncp from 'copy-paste'
import path from 'path'
import fs from 'fs'
import readline from 'readline'
import { execFileSync, execSync } from 'child_process'

import ClovingGPT from '../cloving_gpt'
import { generateCommitMessagePrompt } from '../utils/git_utils'
import { extractFilesAndContent, saveGeneratedFiles, extractMarkdown } from '../utils/string_utils'
import { getAllFilesInDirectory } from '../utils/command_utils'
import { getConfig } from '../utils/config_utils'
import type { ClovingGPTOptions, ChatMessage } from '../utils/types'

class ChatManager {
  private gpt: ClovingGPT
  private rl: readline.Interface
  private chatHistory: ChatMessage[] = []
  private commandHistory: string[] = []
  private historyIndex: number = -1
  private multilineInput: string = ''
  private isMultilineMode: boolean = false
  private contextFiles: Record<string, string> = {}

  constructor(private options: ClovingGPTOptions) {
    options.stream = true
    options.silent = true
    this.gpt = new ClovingGPT(options)
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'cloving> ',
      historySize: 1000,
    })
  }

  async initialize() {
    console.log('Welcome to Cloving REPL. Type "exit" to quit.')
    this.rl.prompt()

    this.setupEventListeners()
    await this.loadContextFiles()
  }

  private setupEventListeners() {
    this.rl.on('line', this.handleLine.bind(this))
    this.rl.on('close', this.handleClose.bind(this))
    process.stdin.on('keypress', this.handleKeypress.bind(this))
  }

  private async loadContextFiles() {
    let files = this.options.files || '.'
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
        this.contextFiles[file] = content
      }
    }
  }

  private async handleLine(line: string) {
    if (this.isMultilineMode) {
      if (line.trim() === '```') {
        this.isMultilineMode = false
        line = this.multilineInput
        this.multilineInput = ''
      } else {
        this.multilineInput += line + '\n'
        this.rl.prompt()
        return
      }
    } else if (line.trim() === '```') {
      this.isMultilineMode = true
      this.multilineInput = ''
      console.log('Entering multiline mode. Type ``` on a new line to end.')
      this.rl.prompt()
      return
    }

    const trimmedLine = line.trim().toLowerCase()

    if (trimmedLine === '') {
      this.rl.prompt()
      return
    }

    this.updateCommandHistory(trimmedLine)

    if (trimmedLine === 'exit') {
      this.rl.close()
      return
    }

    await this.handleCommand(trimmedLine)
    this.rl.prompt()
  }

  private updateCommandHistory(command: string) {
    if (this.commandHistory[0] !== command) {
      this.commandHistory.unshift(command)
      if (this.commandHistory.length > 1000) {
        this.commandHistory.pop()
      }
    }
    this.historyIndex = -1
  }

  private async handleCommand(command: string) {
    switch (command) {
      case 'copy':
        await this.handleCopy()
        break
      case 'save':
        await this.handleSave()
        break
      case 'commit':
        await this.handleCommit()
        break
      default:
        if (this.isGitCommand(command)) {
          this.executeGitCommand(command)
        } else {
          await this.processUserInput(command)
        }
    }
  }

  private async handleCopy() {
    const lastResponse = this.chatHistory.filter(msg => msg.role === 'assistant').pop()
    if (lastResponse) {
      ncp.copy(lastResponse.content, () => {
        console.log('Last response copied to clipboard.')
      })
    } else {
      console.log('No response to copy.')
    }
  }

  private async handleSave() {
    const lastResponse = this.chatHistory.filter(msg => msg.role === 'assistant').pop()
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
  }

  private async handleCommit() {
    const diff = execSync('git diff HEAD').toString().trim()

    if (!diff) {
      console.error('No changes to commit.')
      return
    }

    const prompt = generateCommitMessagePrompt(diff)
    this.gpt.stream = false
    const rawCommitMessage = await this.gpt.generateText({ prompt })
    this.gpt.stream = true

    const commitMessage = extractMarkdown(rawCommitMessage)
    const tempCommitFilePath = path.join('.git', 'SUGGESTED_COMMIT_EDITMSG')
    fs.writeFileSync(tempCommitFilePath, commitMessage)

    try {
      execFileSync('git', ['commit', '-a', '--edit', '--file', tempCommitFilePath], { stdio: 'inherit' })
    } catch (commitError) {
      console.log('Commit was canceled or failed.')
    }

    fs.unlink(tempCommitFilePath, (err) => {
      if (err) throw err
    })
  }

  private isGitCommand(command: string): boolean {
    return command.split(' ').length <= 3 && command.startsWith('git ')
  }

  private executeGitCommand(command: string) {
    try {
      execSync(command, { stdio: 'inherit' })
    } catch (error) {
      console.error('Error running command:', error)
    }
  }

  private async processUserInput(input: string) {
    try {
      this.chatHistory.push({ role: 'user', content: input })

      const prompt = this.generatePrompt(input)
      const responseStream = await this.gpt.streamText({ prompt })

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
        this.chatHistory.push({ role: 'assistant', content: accumulatedContent.trim() })
        this.rl.prompt()
      })

      responseStream.data.on('error', (error: Error) => {
        console.error('Error streaming response:', error)
        this.rl.prompt()
      })
    } catch (error) {
      console.error('Error processing request:', error)
      this.rl.prompt()
    }
  }

  private generatePrompt(input: string): string {
    const contextFileContents = Object.keys(this.contextFiles)
      .map((file) => `### Contents of ${file}\n\n${this.contextFiles[file]}\n\n`)
      .join('\n')

    return `### Chat History

${this.chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

${contextFileContents}

### Task

Don't apologize and when generating code, always include filenames with paths to the code files mentioned and do not be lazy and ask me to keep the existing code or show things like previous code remains unchanged, always include existing code in the response.

${this.chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}`
  }

  private handleClose() {
    console.log('Goodbye!')
    process.exit(0)
  }

  private handleKeypress(_: any, key: { name: string }) {
    if (key && (key.name === 'up' || key.name === 'down')) {
      if (key.name === 'up' && this.historyIndex < this.commandHistory.length - 1) {
        this.historyIndex++
      } else if (key.name === 'down' && this.historyIndex > -1) {
        this.historyIndex--
      }

      if (this.historyIndex >= 0) {
        this.rl.write(null, { ctrl: true, name: 'u' })
        this.rl.write(this.commandHistory[this.historyIndex])
      } else if (this.historyIndex === -1) {
        this.rl.write(null, { ctrl: true, name: 'u' })
      }
    }
  }
}

const chat = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false
  options.stream = true
  const chatManager = new ChatManager(options)
  await chatManager.initialize()
}

export default chat
