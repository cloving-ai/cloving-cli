import axios from 'axios'
import { spawn } from 'child_process'
import process from 'process'
import inquirer from 'inquirer'
import { Adapter } from './adapters/'
import { ClaudeAdapter } from './adapters/claude'
import { OpenAIAdapter } from './adapters/openai'
import { MistralAdapter } from './adapters/mistral'
import { OllamaAdapter } from './adapters/ollama'
import { GeminiAdapter } from './adapters/gemini'
import { getConfig, getPrimaryModel } from '../utils/config_utils'
import type { GPTRequest, ClovingGPTOptions, ClovingConfig } from '../utils/types'

class ClovingGPT {
  public adapter: Adapter
  public silent: boolean
  public temperature: number
  private apiKey: string

  constructor(options: ClovingGPTOptions) {
    const { model: partialModel } = options
    const config: ClovingConfig = getConfig(options)
    if (!config || !config.models) {
      console.log('No cloving configuration found. Please run: cloving config')
      process.exit(1)
    }

    const primaryModel = getPrimaryModel(partialModel)
    if (!primaryModel) {
      console.log('No AI API models found in the cloving configuration. Please run: cloving config')
      process.exit(1)
    }

    const { provider, model, config: modelConfig } = primaryModel
    this.apiKey = modelConfig.apiKey
    this.temperature = options.temperature || modelConfig.temperature || 0.2
    this.silent = options.silent || modelConfig.silent

    switch (provider) {
      case 'claude':
        this.adapter = new ClaudeAdapter(model)
        break
      case 'openai':
        this.adapter = new OpenAIAdapter(model)
        break
      case 'mistral':
        this.adapter = new MistralAdapter(model)
        break
      case 'ollama':
        this.adapter = new OllamaAdapter(model)
        break
      case 'gemini':
        this.adapter = new GeminiAdapter(model)
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  private async reviewPrompt(prompt: string, endpoint: string): Promise<void> {
    if (this.silent) return

    const tokenCount = Math.ceil(prompt.length / 4).toLocaleString()
    const { reviewPrompt } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'reviewPrompt',
        message: `Do you want to review the ~${tokenCount} token prompt before sending it to ${endpoint}?`,
        default: true
      }
    ])

    if (reviewPrompt) {
      const less = spawn('less', ['-R'], { stdio: ['pipe', process.stdout, process.stderr] })

      less.stdin.write(prompt)
      less.stdin.end()

      await new Promise<void>((resolve, reject) => {
        less.on('close', async (code) => {
          if (code !== 0) {
            console.error('less command exited with an error')
            reject(new Error('Less command failed'))
            return
          }

          const { confirmContinue } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmContinue',
              message: 'Do you want to continue?',
              default: true
            }
          ])

          if (!confirmContinue) {
            console.error('Operation cancelled')
            process.exit(1)
          }

          resolve()
        })

        less.stdin.on('error', (err) => {
          if (isNodeError(err) && err.code === 'EPIPE') {
            resolve()
          } else {
            console.error('Pipeline error:', err)
            reject(err)
          }
        })
      })
    }
  }

  public async generateText(request: GPTRequest): Promise<string> {
    request.temperature ||= this.temperature

    const endpoint = this.adapter.getEndpoint()
    const payload = this.adapter.getPayload(request)
    const headers = this.adapter.getHeaders(this.apiKey)

    await this.reviewPrompt(request.prompt, endpoint)

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
