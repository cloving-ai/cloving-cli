import fs from 'fs'
import axios from 'axios'
import path from 'path'
import { EventEmitter } from 'events'
import colors from 'colors'
import highlight from 'cli-highlight'

import ClovingGPT from '../cloving_gpt'
import ChunkManager from './ChunkManager'
import BlockManager from './BlockManager'

import { getPackageVersion } from '../utils/prompt_utils'
import { getClovingConfig } from '../utils/config_utils'
import { addFileOrDirectoryToContext, generateCodegenPrompt } from '../utils/prompt_utils'
import type { CurrentNewBlock, ChatMessage } from '../utils/types'

/**
 * StreamManager class
 *
 * This class extends EventEmitter and manages the streaming of responses from an AI model.
 * It handles the processing of chunks, manages code blocks, and provides animation for code generation.
 */
class StreamManager extends EventEmitter {
  protected gpt: ClovingGPT
  protected prompt: string = ''
  protected responseString: string = ''
  protected contextFiles: Record<string, string> = {}
  protected chatHistory: ChatMessage[] = []
  protected chunkManager: ChunkManager
  protected blockManager: BlockManager
  protected isProcessing: boolean = false
  protected animationInterval: NodeJS.Timeout | null = null
  protected retryCount: number = 0
  protected maxRetries: number = 3

  /**
   * Creates an instance of StreamManager.
   * @param {any} options - Configuration options for the StreamManager.
   */
  constructor(protected options: any) {
    super()
    this.gpt = new ClovingGPT(options)
    this.chunkManager = new ChunkManager()
    this.blockManager = new BlockManager()
  }

  /**
   * Checks for the latest version of the app from GitHub and compares it with the current version.
   * If a new version is available, it notifies the user.
   * @private
   * @returns {Promise<void>}
   */
  protected async checkForLatestVersion(): Promise<void> {
    try {
      const response = await axios.get(
        'https://api.github.com/repos/cloving-ai/cloving-cli/releases/latest',
      )
      const latestVersion = response.data.tag_name
      const currentVersion = `v${getPackageVersion()}`

      if (latestVersion !== currentVersion) {
        console.log(
          colors.bgWhite.black(`\n 🚀 A new version of Cloving is available: ${latestVersion}    `),
        )
        console.log(
          colors.bgWhite.black(`    You are currently using version: ${currentVersion}          `),
        )
        console.log(
          colors.bgWhite.black(
            `    To upgrade, run: ${colors.bgWhite.black.bold('npm install -g cloving@latest')}   `,
          ),
        )
      }
    } catch (error) {
      // ignore errors
    }
  }

  /**
   * Handles the response stream from the AI model.
   * @param {any} responseStream - The stream of responses from the AI model.
   */
  protected handleResponseStream(responseStream: any) {
    this.responseString = ''
    this.setupChunkManagerEvents()
    this.setupBlockManagerEvents()
    this.setupResponseStreamEvents(responseStream)
  }

  /**
   * Sets up event listeners for the BlockManager.
   * @private
   */
  private setupBlockManagerEvents(): void {
    this.blockManager = new BlockManager()

    this.blockManager.on('startGeneratingCode', () => {
      this.setupAnimationInterval()
    })

    this.blockManager.on('endGeneratingCode', () => {
      this.clearAnimation()
    })

    this.blockManager.on('content', (content: string) => {
      process.stdout.write(content)
      this.responseString += content
    })

    this.blockManager.on(
      'codeBlock',
      (codeBlock: { currentNewBlock?: CurrentNewBlock; raw?: string }) => {
        this.handleCodeBlock(codeBlock)
      },
    )
  }

  /**
   * Sets up an animation interval for code generation visualization.
   * @private
   */
  private setupAnimationInterval(): void {
    process.stdout.write(colors.gray.bold('\nGenerating code...  '))
    let animationIndex = 0
    const animationChars = ['/', '|', '\\', '-']
    this.animationInterval = setInterval(() => {
      process.stdout.write('\b'.repeat(1))
      process.stdout.write(colors.gray.bold(animationChars[animationIndex]))
      animationIndex = (animationIndex + 1) % animationChars.length
    }, 100)
  }

  /**
   * Clears the animation interval.
   * @private
   */
  private clearAnimation(): void {
    if (!this.animationInterval) return
    clearInterval(this.animationInterval)
    process.stdout.write('\b'.repeat(100))
  }

  /**
   * Handles the processing of a code block.
   * @private
   * @param {Object} codeBlock - The code block to process.
   * @param {CurrentNewBlock} [codeBlock.currentNewBlock] - The current and new content of the code block.
   * @param {string} [codeBlock.raw] - The raw content of the code block.
   */
  private handleCodeBlock(codeBlock: { currentNewBlock?: CurrentNewBlock; raw?: string }): void {
    const { currentNewBlock, raw } = codeBlock
    if (currentNewBlock?.currentContent && currentNewBlock?.newContent) {
      this.displayCurrentNewBlock(currentNewBlock)
    } else if (raw) {
      this.displayRawCodeBlock(raw)
    } else {
      process.stdout.write(`                                       \n`)
    }

    this.responseString += raw || currentNewBlock
  }

  /**
   * Displays the current and new content of a code block.
   * @private
   * @param {CurrentNewBlock} currentNewBlock - The current and new content of the code block.
   */
  private displayCurrentNewBlock(currentNewBlock: CurrentNewBlock): void {
    const language = currentNewBlock.language.split('\n')[0]
    process.stdout.write(
      colors.gray.bold(`\`\`\`${language}                                       \n`),
    )
    process.stdout.write(colors.gray.bold(`<<<<<<< CURRENT ${currentNewBlock.filePath}\n`))
    try {
      process.stdout.write(highlight(currentNewBlock.currentContent, { language }))
    } catch (error) {
      process.stdout.write(currentNewBlock.currentContent)
    }
    process.stdout.write(colors.gray.bold('\n=======\n'))
    try {
      process.stdout.write(highlight(currentNewBlock.newContent, { language }))
    } catch (error) {
      process.stdout.write(currentNewBlock.newContent)
    }
    process.stdout.write(colors.gray.bold('\n>>>>>>> NEW\n```'))
  }

  /**
   * Displays a raw code block.
   * @private
   * @param {string} raw - The raw content of the code block.
   */
  private displayRawCodeBlock(raw: string): void {
    process.stdout.write(`                                       \n`)
    process.stdout.write(highlight(raw))
  }

  /**
   * Sets up event listeners for the ChunkManager.
   * @private
   */
  private setupChunkManagerEvents(): void {
    this.chunkManager = new ChunkManager()
    this.chunkManager.on('content', (buffer: string) => {
      this.processChunkManagerContent(buffer)
    })
  }

  /**
   * Processes the content received from the ChunkManager.
   * @private
   * @param {string} buffer - The buffer containing the chunk content.
   */
  private processChunkManagerContent(buffer: string): void {
    let convertedStream = this.gpt.convertStream(buffer)

    while (convertedStream !== null) {
      const { output, lastChar } = convertedStream
      this.blockManager.addContent(output)
      this.chunkManager.clearBuffer(lastChar)
      buffer = buffer.slice(lastChar)
      convertedStream = this.gpt.convertStream(buffer)
    }
  }

  /**
   * Sets up event listeners for the response stream.
   * @private
   * @param {any} responseStream - The stream of responses from the AI model.
   */
  private setupResponseStreamEvents(responseStream: any): void {
    responseStream.data.on('data', this.handleResponseStreamData.bind(this))
    responseStream.data.on('end', () => this.finalizeResponse())
    responseStream.data.on('error', this.handleResponseStreamError.bind(this))
  }

  /**
   * Handles the data received from the response stream.
   * @private
   * @param {Buffer | undefined} chunk - The chunk of data received from the stream.
   */
  private handleResponseStreamData(chunk: Buffer | undefined): void {
    if (!chunk) return
    const chunkString = chunk.toString()
    this.chunkManager.addChunk(chunkString)
  }

  /**
   * Handles errors that occur during the response stream.
   * @private
   * @param {Error} error - The error that occurred.
   */
  private handleResponseStreamError(error: Error): void {
    console.error('Error streaming response:', error)
    this.isProcessing = false
    process.stdout.write('\n')
    this.emit('prompt')
  }

  /**
   * Finalizes the response processing.
   * This method should be overridden in subclasses to provide specific finalization behavior.
   * @protected
   */
  protected finalizeResponse(): void {
    this.isProcessing = false
    this.emit('responseFinalized', this.responseString)
  }

  /**
   * Loads context files specified in the options or defaults to the primary language's directory.
   * @private
   * @returns {Promise<void>}
   */
  protected async loadContextFiles(): Promise<void> {
    const config = getClovingConfig()
    const primaryLanguage = config.languages.find((lang) => lang.primary)
    const defaultDirectory = primaryLanguage ? primaryLanguage.directory : '.'
    const testingDirectories =
      config.testingFrameworks?.map((framework) => framework.directory) || []
    const testingDirectory = testingDirectories[0]

    let files = this.options.files || [defaultDirectory, testingDirectory].filter(Boolean)
    if (files.length > 0) {
      console.log(`\nBuilding AI prompt context...\n`)
    }
    for (const file of files) {
      // Skip if the file is not a string
      if (!file) continue

      const previousCount = Object.keys(this.contextFiles).length
      this.contextFiles = await addFileOrDirectoryToContext(file, this.contextFiles, this.options)
      const newCount = Object.keys(this.contextFiles).length
      const addedCount = newCount - previousCount

      const totalTokens = this.calculateTotalTokens()

      console.log(colors.cyan(`📁 Loaded context from: ${colors.bold(file)}`))
      console.log(colors.green(`   ✅ Added ${addedCount} file(s) to context`))
      console.log(colors.yellow(`   📊 Total tokens in context: ${totalTokens.toLocaleString()}\n`))
    }
  }

  protected calculateTotalTokens(): number {
    return Object.values(this.contextFiles).reduce((total, content) => {
      return total + Math.ceil(content.length / 4)
    }, 0)
  }

  protected async refreshContext() {
    await this.reloadContextFiles()
    const updatedSystemPrompt = generateCodegenPrompt(this.contextFiles)
    this.chatHistory[0] = { role: 'user', content: updatedSystemPrompt }
    this.chatHistory[1] = { role: 'assistant', content: 'What would you like to do?' }
  }

  protected async reloadContextFiles() {
    for (const filePath in this.contextFiles) {
      try {
        const content = await fs.promises.readFile(path.resolve(filePath), 'utf8')
        this.contextFiles[filePath] = content
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error)
      }
    }
  }

  protected addUserPrompt(content: string) {
    this.prompt = content
    this.chatHistory.push({ role: 'user', content })
  }

  protected addAssistantResponse(content: string) {
    this.chatHistory.push({ role: 'assistant', content })
  }
}

export default StreamManager
