import axios from 'axios'
import readline from 'readline'
import { spawn } from 'child_process'
import process from 'process'
import { Adapter } from './adapters/'
import { ClaudeAdapter } from './adapters/claude'
import { OpenAIAdapter } from './adapters/openai'
import { GPT4AllAdapter } from './adapters/gpt4all'
import { OllamaAdapter } from './adapters/ollama'
import { getConfig } from '../utils/command_utils'
import type { GPTRequest, ClovingGPTOptions } from '../utils/types'

class ClovingGPT {
  private adapter: Adapter
  private apiKey: string
  private silent: boolean

  constructor(options: ClovingGPTOptions = { silent: false }) {
    const config = getConfig(options)
    if (!config || !config.primaryModel || !config.models) {
      console.log('No cloving configuration found. Please run: cloving config')
      process.exit(1)
    }

    const clovingModel = config.primaryModel
    this.apiKey = config.models[config?.primaryModel || ''].trim()
    this.silent = options.silent || false

    const parts = clovingModel.split(':')
    const model = parts.slice(1).join(':')
    switch (parts[0]) {
      case 'claude':
        this.adapter = new ClaudeAdapter(model)
        break
      case 'openai':
        this.adapter = new OpenAIAdapter(model)
        break
      case 'gpt4all':
        this.adapter = new GPT4AllAdapter(model)
        break
      case 'ollama':
        this.adapter = new OllamaAdapter(model)
        break
      default:
        throw new Error(`Unsupported provider: ${parts[0]}`)
    }
  }

  private async askUserToConfirm(prompt: string, message: string): Promise<boolean> {
    if (this.silent) return true

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    return new Promise((resolve) => {
      rl.question(message, (answer) => {
        rl.close()
        answer = answer.trim().toLowerCase()
        if (answer === 'y' || answer === '') {
          const less = spawn('less', ['-R'], { stdio: ['pipe', process.stdout, process.stderr] })

          less.stdin.write(prompt)
          less.stdin.end()

          less.on('close', (code) => {
            if (code !== 0) {
              console.error('less command exited with an error')
              resolve(false)
              return
            }

            const rlConfirm = readline.createInterface({
              input: process.stdin,
              output: process.stdout
            })
            rlConfirm.question('Do you still want to continue? [Yn]: ', (confirmAnswer) => {
              rlConfirm.close()
              confirmAnswer = confirmAnswer.trim().toLowerCase()
              if (confirmAnswer !== 'y' && confirmAnswer !== '') {
                console.error('User cancelled the operation')
                process.exit(1)
              } else {
                resolve(true)
              }
            })
          })

          less.stdin.on('error', (err) => {
            if (isNodeError(err) && err.code === 'EPIPE') {
              resolve(true)
            } else {
              console.error('Pipeline error:', err)
              resolve(false)
            }
          })
        } else {
          resolve(true)
        }
      })
    })
  }

  public async generateText(request: GPTRequest): Promise<string> {
    const endpoint = this.adapter.getEndpoint()
    const payload = this.adapter.getPayload(request)
    const headers = this.adapter.getHeaders(this.apiKey)
    const tokenCount = Math.ceil(request.prompt.length / 4).toLocaleString()
    const shouldContinue = await this.askUserToConfirm(request.prompt, `Do you want to review the ~${tokenCount} token prompt before sending it to ${endpoint}? [Yn]: `)

    if (!shouldContinue) {
      throw 'Operation cancelled by the user.'
    }

    try {
      const response = await axios.post(endpoint, payload, { headers })
      return this.adapter.extractResponse(response.data)
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : 'connection error'
      if (errorMessage === '') {
        errorMessage = 'connection error'
      }
      console.error(`Error communicating with the GPT server (${this.adapter.getEndpoint()}):`, errorMessage)
      throw error
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export default ClovingGPT
