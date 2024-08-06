import express from 'express'
import bodyParser from 'body-parser'
import fs from 'fs'
import path from 'path'

import ClovingGPT from '../cloving_gpt'
import { getClovingConfig } from '../utils/config_utils'
import { getAllFilesInDirectory } from '../utils/command_utils'
import type { ClovingGPTOptions } from '../utils/types'

const proxy = (options: ClovingGPTOptions) => {
  options.silent = true
  options.stream = true
  const app = express()
  app.use(bodyParser.json())
  const gpt = new ClovingGPT(options)

  app.get('/', async (_req, res) => {
    res.json({ message: 'ClovingGPT proxy server running' })
  })

  app.post('/v1/chat/completions', async (req, res) => {
    try {
      const { messages, stream } = req.body
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

      // get the content of all message in array
      const content = messages.map((message: any) => message.content).join('\n\n')

      const contextFileContents = Object.keys(contextFiles).map((file) => `### Contents of ${file}\n\n${contextFiles[file]}\n\n`).join('\n')
      const prompt = `### Task

${content}

### Description of App

${JSON.stringify(getClovingConfig(), null, 2)}

${contextFileContents}

### Task

${content}`

      if (stream) {
        const shortPrompt = prompt.replace('### Task', '').trim().slice(0, 50).replace(/\n/g, ' ')
        const promptTokens = Math.ceil(prompt.length / 4).toLocaleString()
        console.log(`> sending ${promptTokens} token prompt:`, shortPrompt)
        const responseStream = await gpt.streamText({ prompt })

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Transfer-Encoding', 'chunked')

        let convertedChunks = [] as string[]
        responseStream.data.on('data', (chunk: Buffer) => {
          const chunkString = chunk.toString()
          const convertedChunk = gpt.convertStream(chunkString)
          if (convertedChunk) {
            const { output } = convertedChunk
            convertedChunks.push(output)
            // check if convertedChunks.join('\n') has two 'data:' strings in it
            if (convertedChunks.join('\n').split('data: ').length > 2) {
              res.write(convertedChunks.join('\n'))
              convertedChunks = []
            }
          }
        })

        responseStream.data.on('end', () => {
          res.end()
        })

        responseStream.data.on('error', (error: Error) => {
          console.error('Error streaming response:', error)
          res.status(500).json({ error: 'Internal server error' })
        })
      } else {
        const content = await gpt.generateText({ prompt })

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
    } catch (error) {
      console.error('Error processing request:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  const port = parseInt(`${process.env.PORT || options.port || 3000}`, 10)

  app.listen(port, () => {
    console.log(`ClovingGPT proxy server running on port ${port}`)
  })
}

export default proxy
