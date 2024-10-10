import express, { Request, Response } from 'express'
import bodyParser from 'body-parser'
import fs from 'fs'
import path from 'path'

import ClovingGPT from '../cloving_gpt'
import ChunkManager from './ChunkManager'
import { getClovingConfig } from '../utils/config_utils'
import { getAllFilesInDirectory } from '../utils/prompt_utils'
import type { ClovingGPTOptions } from '../utils/types'

class ProxyManager {
  private gpt: ClovingGPT
  private app: express.Application
  private contextFiles: Record<string, string> = {}
  private chunkManager: ChunkManager

  /**
   * Creates an instance of ProxyManager.
   * @param {ClovingGPTOptions} options - Configuration options for the ProxyManager.
   * @description
   * Initializes the ProxyManager with the given options. It sets up:
   * - A ClovingGPT instance with silent and stream options enabled
   * - An Express application with JSON body parsing
   * - A ChunkManager for handling streaming responses
   */
  constructor(private options: ClovingGPTOptions) {
    this.options.silent = true
    this.options.stream = true
    this.gpt = new ClovingGPT(this.options)
    this.app = express()
    this.app.use(bodyParser.json())
    this.chunkManager = new ChunkManager()
  }

  async initialize() {
    await this.setupRoutes()
    await this.loadContextFiles()
    this.startServer()
  }

  private async setupRoutes() {
    this.app.get('/', (_req: Request, res: Response) => {
      res.json({ message: 'ClovingGPT proxy server running' })
    })

    this.app.post('/v1/chat/completions', async (req, res, next) => {
      try {
        await this.handleChatCompletions(req, res)
      } catch (error) {
        next(error)
      }
    })
  }

  private async loadContextFiles() {
    let files = this.options.files || '.'

    let expandedFiles: string[] = []
    for (const file of files) {
      const filePath = path.resolve(file)
      if (
        await fs.promises
          .stat(filePath)
          .then((stat) => stat.isDirectory())
          .catch(() => false)
      ) {
        const dirFiles = await getAllFilesInDirectory(filePath)
        expandedFiles = expandedFiles.concat(dirFiles.map((f) => path.relative(process.cwd(), f)))
      } else {
        expandedFiles.push(path.relative(process.cwd(), filePath))
      }
    }
    files = expandedFiles

    for (const file of files) {
      const filePath = path.resolve(file)
      if (
        await fs.promises
          .stat(filePath)
          .then((stat) => stat.isFile())
          .catch(() => false)
      ) {
        const content = await fs.promises.readFile(filePath, 'utf-8')
        this.contextFiles[file] = content
      }
    }
  }

  private async handleChatCompletions(req: Request, res: Response) {
    try {
      const { messages, stream } = req.body

      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid request body: messages must be an array' })
      }

      const content = messages
        .map((message: any) => {
          if (typeof message !== 'object' || typeof message.content !== 'string') {
            throw new Error('Invalid message format')
          }
          return message.content
        })
        .join('\n\n')

      const contextFileContents = Object.keys(this.contextFiles)
        .map((file) => `### Contents of ${file}\n\n${this.contextFiles[file]}\n\n`)
        .join('\n')
      const prompt = `# Task

${content}

### Description of App

${JSON.stringify(getClovingConfig(), null, 2)}

${contextFileContents}

# Task

${content}`

      if (stream) {
        await this.handleStreamResponse(prompt, res)
      } else {
        await this.handleNonStreamResponse(prompt, res)
      }
    } catch (error) {
      console.error('Error processing request:', error)
      if (error instanceof Error && error.message === 'Invalid message format') {
        res.status(400).json({
          error: 'Invalid request body: each message must have a content property of type string',
        })
      } else {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  }

  private async handleStreamResponse(prompt: string, res: Response) {
    const shortPrompt = prompt.replace('### Task', '').trim().slice(0, 50).replace(/\n/g, ' ')
    const promptTokens = Math.ceil(prompt.length / 4).toLocaleString()
    console.log(`> sending ${promptTokens} token prompt:`, shortPrompt)
    const responseStream = await this.gpt.streamText({ prompt })

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Transfer-Encoding', 'chunked')

    let convertedStreams: string[] = []
    // Add initial stream to indicate the start of the response
    convertedStreams.push(
      '{"id":"chatcmpl-9tLvSuRQaYzQIiKRAwI5a7WqdJspq","object":"chat.completion.chunk","created":1722979349,"model":"cloving","system_fingerprint":"fp_3aa7262c27","choices":[{"index":0,"delta":{"role":"assistant","content":"","refusal":null},"logprobs":null,"finish_reason":null}]}',
    )

    this.chunkManager.on('content', (buffer: string) => {
      let convertedStream = this.gpt.convertStream(buffer)

      while (convertedStream !== null) {
        const { output, lastChar } = convertedStream
        const content = JSON.stringify({
          id: 'chatcmpl-9tLvSuRQaYzQIiKRAwI5a7WqdJspq',
          object: 'chat.completion.chunk',
          created: 1722979350,
          model: 'cloving',
          system_fingerprint: 'fp_3aa7262c27',
          choices: [{ index: 0, delta: { content: output }, logprobs: null, finish_reason: null }],
        })

        convertedStreams.push(content)

        if (convertedStreams.length >= 2) {
          const dataToSend = convertedStreams.map((c) => `data: ${c}`).join('\n\n')
          res.write(`${dataToSend}\n\n`)
          convertedStreams = []
        }

        buffer = buffer.slice(lastChar)
        convertedStream = this.gpt.convertStream(buffer)
      }
    })

    responseStream.data.on('data', (chunk: Buffer) => {
      const chunkString = chunk.toString()
      this.chunkManager.addChunk(chunkString)
    })

    responseStream.data.on('end', () => {
      // Send any remaining converted streams
      const dataToSend = convertedStreams.map((c) => `data: ${c}`).join('\n\n')
      res.write(`${dataToSend}\n\ndata: [DONE]\n\n`)
      res.end()
    })

    responseStream.data.on('error', (error: Error) => {
      console.error('Error streaming response:', error)
      res.status(500).json({ error: 'Internal server error' })
    })
  }

  private async handleNonStreamResponse(prompt: string, res: Response) {
    const content = await this.gpt.generateText({ prompt })

    const response = {
      id: 'chatcmpl-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'cloving',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          logprobs: null,
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: Math.ceil(prompt.length / 4),
        completion_tokens: Math.ceil(content.length / 4),
        total_tokens: Math.ceil(prompt.length / 4) + Math.ceil(content.length / 4),
      },
      system_fingerprint: 'fp_3cd8b62c3b',
    }

    res.json(response)
  }

  private startServer() {
    const port = parseInt(`${process.env.PORT || this.options.port || 3000}`, 10)

    this.app.listen(port, () => {
      console.log(`ClovingGPT proxy server running on port ${port}`)
    })
  }
}

export default ProxyManager
