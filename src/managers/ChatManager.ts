import ncp from 'copy-paste'
import colors from 'colors'
import highlight from 'cli-highlight'
import readline from 'readline'
import { execSync } from 'child_process'
import type { AxiosError } from 'axios'

import CommitManager from './CommitManager'
import ReviewManager from './ReviewManager'
import {
  extractCurrentNewBlocks,
  applyAndSaveCurrentNewBlocks,
  checkBlocksApplicability,
} from '../utils/string_utils'
import { addFileOrDirectoryToContext } from '../utils/prompt_utils'
import { CODEGEN_COULDNT_APPLY } from '../utils/prompts'
import type { ClovingGPTOptions } from '../utils/types'
import StreamManager from './StreamManager'

const specialCommands = [
  'save',
  'commit',
  'copy',
  'review',
  'add <file-path>',
  'find <file-name>',
  'rm <pattern>',
  'ls <pattern>',
  'git <command>',
  'help',
  'exit',
]

class ChatManager extends StreamManager {
  private commandHistory: string[] = []
  private historyIndex: number = -1
  private multilineInput: string = ''
  private isMultilineMode: boolean = false
  private isSilent = false
  private rl: readline.Interface

  /**
   * Creates an instance of ChatManager.
   * @param {ClovingGPTOptions} options - Configuration options for the ChatManager.
   */
  constructor(options: ClovingGPTOptions) {
    super(options)
    this.isSilent = options.silent || false
    options.stream = true
    options.silent = true
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: colors.green.bold('cloving> '),
      historySize: 1000,
    })
  }

  /**
   * Initializes the ChatManager by loading context files, displaying a welcome message,
   * and setting up event listeners.
   * @returns {Promise<void>}
   */
  async initialize(): Promise<void> {
    await this.checkForLatestVersion()
    await this.loadContextFiles()
    console.log(`\n🍀 🍀 🍀 ${colors.bold('Welcome to Cloving REPL')} 🍀 🍀 🍀\n`)
    this.displayAvailableCommands()
    console.log('\nWhat would you like to do?')
    this.setupReadline()
  }

  private displayAvailableCommands(): void {
    console.log(
      `Type a freeform request or question to interact with your Cloving AI pair programmer.\n`,
    )
    console.log('Available special commands:')
    console.log(
      ` - ${colors.yellow(colors.bold('save'))}             Save all the changes from the last response to files`,
    )
    console.log(
      ` - ${colors.yellow(colors.bold('commit'))}           Commit the changes to git with an AI-generated message that you can edit`,
    )
    console.log(
      ` - ${colors.yellow(colors.bold('copy'))}             Copy the last response to clipboard`,
    )
    console.log(` - ${colors.yellow(colors.bold('review'))}           Start a code review`)
    console.log(
      ` - ${colors.yellow(colors.bold('find <file-name>'))} Find and add files matching the name to the chat context (supports * for glob matching)`,
    )
    console.log(
      ` - ${colors.yellow(colors.bold('add <file-path>'))}  Add a file to the chat context (supports * for glob matching)`,
    )
    console.log(
      ` - ${colors.yellow(colors.bold('rm <pattern>'))}     Remove files from the chat context (supports * for glob matching)`,
    )
    console.log(
      ` - ${colors.yellow(colors.bold('ls <pattern>'))}     List files in the chat context (supports * for glob matching)`,
    )
    console.log(` - ${colors.yellow(colors.bold('git <command>'))}    Run a git command`)
    console.log(` - ${colors.yellow(colors.bold('help'))}             Display this help message`)
    console.log(` - ${colors.yellow(colors.bold('exit'))}             Quit this session`)
  }

  /**
   * Sets up readline and event listeners for the readline interface and process input.
   * @private
   */
  private setupReadline(): void {
    this.rl.prompt()
    this.rl.on('line', this.handleLine.bind(this))
    this.rl.on('close', this.handleClose.bind(this))
    process.stdin.on('keypress', this.handleKeypress.bind(this))
  }

  /**
   * Handles each line of input from the user.
   * @private
   * @param {string} line - The input line from the user.
   * @returns {Promise<void>}
   */
  private async handleLine(line: string): Promise<void> {
    if (this.isProcessing) {
      return
    }

    const trimmedLine = line.trim()

    if (this.handleMultilineInput(trimmedLine)) {
      return
    }

    if (trimmedLine === '') {
      this.displayPrompt()
      return
    }

    this.updateCommandHistory(trimmedLine)

    if (this.handleExitCommand(trimmedLine)) {
      return
    }

    await this.handleCommand(trimmedLine)
  }

  private handleMultilineInput(line: string): boolean {
    if (this.isMultilineMode) {
      if (line === '```') {
        this.isMultilineMode = false
        this.handleCommand(this.multilineInput)
        this.multilineInput = ''
      } else {
        this.multilineInput += line + '\n'
        this.rl.prompt()
      }
      return true
    } else if (line === '```') {
      this.isMultilineMode = true
      this.multilineInput = ''
      console.log('Entering multiline mode. Type ``` on a new line to end.\n')
      this.rl.prompt()
      return true
    }
    return false
  }

  private handleExitCommand(command: string): boolean {
    if (command.toLowerCase() === 'exit') {
      this.rl.close()
      return true
    }
    return false
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

  /**
   * Handles various commands entered by the user.
   * This function acts as a command router, delegating to specific handlers based on the input.
   *
   * @private
   * @param {string} command - The command entered by the user.
   * @returns {Promise<void>}
   *
   * @description
   * Supported commands:
   * - 'copy': Copies the last response to clipboard.
   * - 'save': Saves changes to files.
   * - 'commit': Commits changes to git with an AI-generated message.
   * - 'ls': Lists files in the context (equivalent to 'ls *').
   * - 'rm': Removes all files from the context (equivalent to 'rm *').
   * - 'review': Starts a code review.
   * - 'add <file-path>': Adds a file to the context.
   * - 'rm <pattern>': Removes files matching the pattern from the context.
   * - 'ls <pattern>': Lists files in the context matching the pattern.
   * - 'git <command>': Executes a git command.
   * - Any other input is processed as a user query to the AI.
   */
  private async handleCommand(command: string): Promise<void> {
    // Check if the command is a single character and map it to the first matching special command
    if (command.length === 1) {
      const matchingCommand = specialCommands.find((cmd) => cmd.startsWith(command))
      if (matchingCommand) {
        command = matchingCommand.split(' ')[0] // Use only the command part without arguments
      }
    }

    switch (command) {
      case 'help':
        this.displayHelp()
        break
      case 'copy':
        await this.handleCopy()
        break
      case 'save':
        await this.handleSave()
        break
      case 'commit':
        await this.handleCommit()
        break
      case 'ls':
        this.handleList('ls *')
        break
      case 'rm':
        await this.handleRemove('rm *')
        break
      case 'review':
        await this.handleReview()
        break
      default:
        if (this.isAddCommand(command)) {
          await this.handleAdd(command)
        } else if (this.isFindCommand(command)) {
          await this.handleFind(command)
        } else if (this.isRemoveCommand(command)) {
          await this.handleRemove(command)
        } else if (this.isListCommand(command)) {
          this.handleList(command)
        } else if (this.isGitCommand(command)) {
          this.executeGitCommand(command)
        } else {
          await this.processUserInput(command)
        }
    }
  }

  private isFindCommand(command: string): boolean {
    const parts = command.trim().split(/\s+/)
    return parts.length === 2 && parts[0] === 'find'
  }

  private async handleFind(command: string) {
    const fileName = command.slice(5).trim()

    if (fileName) {
      try {
        const foundFiles = await this.findFiles(fileName)
        if (foundFiles.length === 0) {
          console.log(`No files found matching ${colors.bold(colors.red(fileName))}.`)
        } else {
          for (const filePath of foundFiles) {
            this.contextFiles = await addFileOrDirectoryToContext(
              filePath,
              this.contextFiles,
              this.options,
            )
            const content = this.contextFiles[filePath]
            const tokenEstimate = this.estimateTokens(content)
            console.log(
              `\nAdded ${colors.bold(colors.green(filePath))} to this chat session's context (${colors.yellow(`~${tokenEstimate.toLocaleString()} tokens`)})`,
            )
          }
          const totalTokens = this.calculateTotalTokens()
          console.log(
            colors.yellow(`\n📊 Total tokens in context now: ${totalTokens.toLocaleString()}\n`),
          )
        }
      } catch (error) {
        console.error(
          `Failed to find and add files matching ${colors.bold(colors.red(fileName))}:`,
          error,
        )
      }
    } else {
      console.log('No file name provided.')
    }

    this.rl.prompt()
  }

  private async findFiles(fileName: string): Promise<string[]> {
    const { exec } = require('child_process')
    return new Promise((resolve, reject) => {
      exec(`find . -name "${fileName}"`, (error: Error | null, stdout: string) => {
        if (error) {
          return reject(error)
        }
        const files = stdout
          .split('\n')
          .filter((filePath) => filePath.trim() !== '')
          .map((filePath) => (filePath.startsWith('./') ? filePath.slice(2) : filePath))
        resolve(files)
      })
    })
  }

  private displayHelp(): void {
    console.log('')
    this.displayAvailableCommands()
    console.log('\nFor any other input, I will process it as a request or question.\n')
    this.rl.prompt()
  }

  private isAddCommand(command: string): boolean {
    const parts = command.trim().split(/\s+/)
    return parts.length === 2 && parts[0] === 'add'
  }

  private async handleAdd(command: string) {
    const filePath = command.slice(4).trim()

    if (filePath) {
      try {
        this.contextFiles = await addFileOrDirectoryToContext(
          filePath,
          this.contextFiles,
          this.options,
        )
        console.log(`\nAdded ${colors.bold(colors.green(filePath))} to this chat session's context`)
        this.refreshContext()
      } catch (error) {
        console.error(
          `Failed to add ${colors.bold(colors.red(filePath))} to this chat session's context:`,
          error,
        )
      }
    } else {
      console.log('No file path provided.')
    }

    this.rl.prompt()
  }

  private isRemoveCommand(command: string): boolean {
    return command.startsWith('rm ')
  }

  // Function to convert glob-like pattern to a regular expression
  private globToRegExp(glob: string): RegExp {
    const escapedGlob = glob.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&')
    const regexString = escapedGlob.replace(/\*/g, '.*')
    return new RegExp(`^${regexString}$`)
  }

  // Function to filter paths using the pattern
  private filterPaths(paths: string[], pattern: string): string[] {
    const regex = this.globToRegExp(pattern)
    return paths.filter((path) => regex.test(path))
  }

  private async handleRemove(command: string) {
    const pattern = command.slice(3).trim()

    if (pattern) {
      const matchedFiles = this.filterPaths(Object.keys(this.contextFiles), pattern)

      if (matchedFiles.length > 0) {
        matchedFiles.forEach((filePath) => {
          delete this.contextFiles[filePath]
          console.log(
            `Removed ${colors.bold(colors.green(filePath))} from this chat session's context files`,
          )
        })
      } else {
        console.log(
          `No files matching pattern "${colors.bold(pattern)}" found in this chat session's context files, try running ${colors.yellow('ls')} to see the list of files.`,
        )
      }
    } else {
      console.log('No pattern provided.')
    }

    this.rl.prompt()
  }

  private isListCommand(command: string): boolean {
    return command.startsWith('ls ')
  }

  private estimateTokens(text: string): number {
    // A simple estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }

  private handleList(command: string) {
    const pattern = command.slice(3).trim()
    const fileNames = Object.keys(this.contextFiles)

    const matchedFiles = pattern ? this.filterPaths(fileNames, pattern) : fileNames

    if (matchedFiles.length > 0) {
      console.log(`\nFiles in the current chat session context:`)
      let totalTokens = 0
      matchedFiles.forEach((fileName) => {
        const content = this.contextFiles[fileName]
        const tokenEstimate = this.estimateTokens(content)
        totalTokens += tokenEstimate
        console.log(
          ` - ${colors.bold(colors.green(fileName))} (${colors.yellow(`~${tokenEstimate.toLocaleString()} tokens`)})`,
        )
      })
      console.log(`\nTotal files: ${matchedFiles.length}`)
      console.log(`Total estimated tokens: ${colors.yellow(totalTokens.toLocaleString())}\n`)
    } else {
      console.log('No files currently in context.')
    }
    this.rl.prompt()
  }

  private async handleCopy() {
    const lastResponse = this.chatHistory.filter((msg) => msg.role === 'assistant').pop()
    if (lastResponse) {
      ncp.copy(lastResponse.content, () => {
        console.info('Last response copied to clipboard.')
        this.rl.prompt()
      })
    } else {
      console.error('No response to copy.')
    }
  }

  private async handleReview() {
    this.options.stream = false
    const reviewManager = new ReviewManager(this.options)
    await reviewManager.generateReview()
    this.options.stream = true
    this.rl.prompt()
  }

  private async handleCommit() {
    this.options.stream = false
    const commitManager = new CommitManager(this.options)
    await commitManager.generateCommit()
    this.options.stream = true
    this.rl.prompt()
  }

  private async handleSave() {
    if (this.fullResponse) {
      const currentNewBlocks = extractCurrentNewBlocks(this.fullResponse)
      if (Object.keys(currentNewBlocks).length > 0) {
        await applyAndSaveCurrentNewBlocks(currentNewBlocks)
        console.info(`\n${colors.bold('save')} has finished\n`)
        this.rl.prompt()
      } else {
        console.info('No changes found to save in the last response.')
        this.rl.prompt()
      }
    } else {
      console.error('No response to save files from.')
      this.rl.prompt()
    }
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
    this.rl.prompt()
  }

  /**
   * Processes user input by sending it to the AI model and handling the response.
   *
   * This method manages the interaction with the AI model by:
   * 1. Checking if a request is already being processed.
   * 2. Initializing the chat history and generating a prompt.
   * 3. Streaming the response from the AI model.
   * 4. Handling the response stream and updating the chat history.
   *
   * @param {string} input - The user's input or request to be processed.
   * @returns {Promise<void>} - A promise that resolves when the processing is complete.
   */
  private async processUserInput(input: string): Promise<void> {
    if (this.isProcessing) {
      console.log('Please wait for the current request to complete.')
      return
    }

    this.isProcessing = true

    try {
      this.fullResponse = ''
      await this.refreshContext()
      this.addUserPrompt(this.generatePrompt(input))

      if (!this.isSilent) {
        const fullPrompt = this.chatHistory
          .map((m) => {
            const content = m.content
              .split('\n')
              .map((line) => {
                if (line.startsWith('###')) {
                  return colors.red.bold(line)
                } else if (line.startsWith('##')) {
                  return colors.yellow.bold(line)
                }
                return line
              })
              .join('\n')
            return m.role === 'user'
              ? `${colors.yellow.bold('## User Prompt')}\n\n${content}`
              : `${colors.green.bold("## 🍀 Cloving's Response 🍀")}\n\n${content}`
          })
          .join('\n\n')

        // Review the prompt using the REPL
        const tokenCount = Math.ceil(fullPrompt.length / 4).toLocaleString()
        console.log(
          `${colors.yellow.bold('INFORMATION')} The generated prompt is approximately ${tokenCount} tokens long. Would you like to review the prompt before sending it? ${colors.gray('(Y/n)')}`,
        )

        const reviewPrompt = await new Promise<string>((resolve) => {
          this.rl.question(colors.green.bold('cloving> '), (answer) => {
            resolve(answer.trim().toLowerCase())
          })
        })

        if (reviewPrompt.startsWith('y') || reviewPrompt === '') {
          console.log(
            colors.gray.bold('\n---------------------- PROMPT START ----------------------\n'),
          )
          const promptParts = fullPrompt.split('\n```')
          const highlightedPrompt = promptParts
            .map((part, index) =>
              index % 2 === 1 ? highlight(part, { language: 'typescript' }) : part,
            )
            .join('\n```')
          console.log(highlightedPrompt)
          console.log(
            colors.gray.bold('\n---------------------- PROMPT END ----------------------\n'),
          )
          console.log(`Do you want to proceed with this prompt? ${colors.gray('(Y/n)')}`)

          const confirmPrompt = await new Promise<string>((resolve) => {
            this.rl.question(colors.green.bold('cloving> '), (answer) => {
              resolve(answer.trim().toLowerCase())
            })
          })

          if (!confirmPrompt.startsWith('y') && confirmPrompt !== '') {
            console.log('Operation cancelled by user.')
            this.isProcessing = false
            this.rl.prompt()
            return
          }
        }
      }

      const responseStream = await this.gpt.streamText({
        prompt: this.prompt,
        messages: this.chatHistory,
      })

      this.handleResponseStream(responseStream)
    } catch (err) {
      this.handleError(err as AxiosError)
    }
  }

  protected async finalizeResponse(): Promise<void> {
    console.log('\n')
    this.fullResponse += `${this.responseString}\n\n`
    this.addAssistantResponse(this.responseString)
    this.isProcessing = false

    if (!this.responseString.includes('======= DONE =======')) {
      this.addUserPrompt(
        "If there is more, continue, otherwise print the string '======= DONE ======='.",
      )
      const responseStream = await this.gpt.streamText({
        prompt: this.prompt,
        messages: this.chatHistory,
      })

      this.handleResponseStream(responseStream)
      return
    }

    if (this.fullResponse !== '') {
      const currentNewBlocks = extractCurrentNewBlocks(this.fullResponse)
      const [canApply, summary] = await checkBlocksApplicability(currentNewBlocks)
      if (!canApply) {
        if (this.retryCount < this.maxRetries) {
          console.log(
            `\n\n${summary}\n\n${colors.yellow.bold('WARNING')} Some of the provided code blocks could not be automatically applied. Retrying (Attempt ${this.retryCount + 1}/${this.maxRetries})...\n`,
          )

          this.retryCount++
          this.processUserInput(`${CODEGEN_COULDNT_APPLY}\n\n${summary}`)

          return
        } else {
          console.log(
            `\n\n${colors.red.bold('ERROR')} Failed to generate a diff that could be cleanly applied after ${this.maxRetries} attempts. Please review the changes manually and try again.\n`,
          )
          this.retryCount = 0 // Reset the retry count for future attempts
        }
      } else {
        this.retryCount = 0 // Reset the retry count on successful application
      }
    }

    process.stdout.write(`

You can follow up with another request or:
  - type ${colors.yellow(colors.bold('"save"'))} to save all the changes to files
  - type ${colors.yellow(colors.bold('"commit"'))} to commit the changes to git with a AI - generated message
  - type ${colors.yellow(colors.bold('"copy"'))} to copy the last response to clipboard
  - type ${colors.yellow(colors.bold('"review"'))} to start a code review
  - type ${colors.yellow(colors.bold('"add <file-path>"'))} to add a file to the chat context
  - type ${colors.yellow(colors.bold('"rm <pattern>"'))} to remove files from the chat context
  - type ${colors.yellow(colors.bold('"ls <pattern>"'))} to list files in the chat context
  - type ${colors.yellow(colors.bold('"git <command>"'))} to run a git command
  - type ${colors.yellow(colors.bold('"exit"'))} to quit this session
  `)
    this.rl.prompt()
  }

  private handleError(error: AxiosError) {
    let errorMessage = error.message || 'An error occurred.'
    const errorNumber = error.response?.status || 'unknown'

    switch (errorNumber) {
      case 400:
        errorMessage = 'Invalid model or prompt size too large. Try specifying fewer files.'
        break
      case 403:
        errorMessage = 'Inactive subscription or usage limit reached'
        break
      case 429:
        errorMessage = 'Rate limit error'
        break
      case 500:
        errorMessage = 'Internal server error'
        break
    }

    const statusMessage = (error.response?.data as any)?.statusMessage
    console.error(
      colors.red(
        `\nError (${errorNumber}) while submitting the prompt to the AI API\n\n${statusMessage}\n`,
      ),
    )
    this.isProcessing = false
    this.rl.prompt()
  }

  /**
   * Generates a comprehensive prompt for the AI model.
   *
   * This function constructs a detailed prompt that includes:
   * 1. The user's current request
   * 2. Contents of all context files
   * 3. Full chat history (excluding the current request)
   * 4. The current request repeated at the end
   *
   * @private
   * @param {string} prompt - The user's current request or input.
   * @returns {string} A formatted string containing the complete prompt for the AI.
   *
   * @description
   * The generated prompt follows this structure:
   * 1. "### Request" section with the current prompt
   * 2. Contents of all context files, each prefixed with its file name
   * 3. "### Full Chat History Context" section with all previous messages
   * 4. "### Current Request" section repeating the current prompt
   *
   * This structure provides the AI with comprehensive context for generating
   * accurate and relevant responses.
   */
  private generatePrompt(prompt: string): string {
    return `### Request

${prompt}

### Note

Whenever possible, break up the changes into pieces and make sure every change is in its own CURRENT / NEW block.
Do not allow empty CURRENT blocks and if you add content to the CURRENT block, you also have to add the same content to the NEW block.`
  }

  private handleClose() {
    console.log('Goodbye!')
    process.exit(0)
  }

  /**
   * Displays the prompt in green and bold.
   * This method should be used instead of directly calling this.rl.prompt().
   * @private
   */
  private displayPrompt() {
    this.rl.setPrompt(colors.green.bold('cloving> '))
    this.rl.prompt()
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
    } else if (key && key.name === 'tab') {
      const line = this.rl.line.trim()
      const hits = specialCommands.filter((command) => command.startsWith(line))
      if (hits.length > 0) {
        this.rl.write(null, { ctrl: true, name: 'u' })
        this.rl.write(hits[0])
      }
    }
  }
}

export default ChatManager
