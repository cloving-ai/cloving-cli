import highlight from 'cli-highlight'
import process from 'process'
import colors from 'colors'
import { confirm } from '@inquirer/prompts'
import axios, { AxiosResponse, AxiosError } from 'axios'

import { Adapter } from './adapters/'
import { ClaudeAdapter } from './adapters/claude'
import { OpenAIAdapter } from './adapters/openai'
import { MistralAdapter } from './adapters/mistral'
import { OllamaAdapter } from './adapters/ollama'
import { GeminiAdapter } from './adapters/gemini'
import { AzureOpenAIAdapter } from './adapters/azureopenai'
import { parseMarkdownInstructions } from '../utils/string_utils'
import { getConfig, getPrimaryModel } from '../utils/config_utils'

import type {
  OpenAIStreamChunk,
  GPTRequest,
  ClovingGPTOptions,
  ClovingConfig,
  ChatMessage,
} from '../utils/types'

class ClovingGPT {
  public adapter: Adapter
  public silent: boolean
  public temperature: number
  public stream: boolean
  private apiKey: string
  private timeout: number

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
    this.silent = options.silent || modelConfig.silent || false
    this.stream = options.stream || false
    this.timeout = options.timeout || 60000 // Default timeout of 60 seconds

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
      case 'azureopenai':
        if (!modelConfig.endpoint) {
          throw new Error('Azure OpenAI endpoint not configured')
        }
        this.adapter = new AzureOpenAIAdapter(model, modelConfig.endpoint)
        break
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  private async reviewPrompt(
    prompt: string,
    messages: ChatMessage[],
    endpoint: string,
  ): Promise<string | null> {
    if (this.silent) return prompt

    const fullPrompt = messages
      .map((m) => (m.role === 'user' ? `# Task\n\n${m.content}` : m.content))
      .join('\n\n')

    const tokenCount = Math.ceil(fullPrompt.length / 4).toLocaleString()
    const reviewPrompt = await confirm({
      message: `Do you want to review the ~${tokenCount} token prompt before sending it to ${endpoint}?`,
      default: true,
    })

    if (reviewPrompt) {
      parseMarkdownInstructions(fullPrompt).map((code) => {
        if (code.trim().startsWith('```')) {
          const lines = code.split('\n')
          const language = code.match(/```(\w+)/)?.[1] || 'default'
          console.log(lines[0])
          try {
            if (language === 'default') {
              console.log(highlight(lines.slice(1, -1).join('\n')))
            } else {
              console.log(highlight(lines.slice(1, -1).join('\n'), { language }))
            }
          } catch (error) {
            // don't highlight if it fails
            console.log(lines.slice(1, -1).join('\n'))
          }
          console.log(lines.slice(-1)[0])
        } else {
          console.log(highlight(code, { language: 'markdown' }))
        }
      })

      const confirmPrompt = await confirm({
        message: `Are you sure you want to continue?`,
        default: true,
      })

      if (!confirmPrompt) {
        process.exit(1)
      }
    }

    return prompt
  }

  public async streamText(request: GPTRequest): Promise<AxiosResponse> {
    request.stream = true
    request.temperature ||= this.temperature

    const endpoint = this.adapter.getEndpoint(this.stream)
    const payload = this.adapter.getPayload(request, this.stream)
    const headers = this.adapter.getHeaders(this.apiKey)

    const reviewedPrompt = await this.reviewPrompt(request.prompt, request.messages || [], endpoint)
    if (reviewedPrompt === null) {
      throw new Error('Operation cancelled by user')
    }
    request.prompt = reviewedPrompt

    const maxRetries = 5
    let attempt = 0
    let delay = 1000 // Initial delay of 1 second

    while (attempt < maxRetries) {
      try {
        return await axios({
          method: 'post',
          url: endpoint,
          data: payload,
          headers: headers,
          responseType: 'stream',
          timeout: this.timeout,
        })
      } catch (err) {
        const error = err as AxiosError
        if (error.response && error.response.status === 429) {
          attempt++
          const tokenCount = payload.messages
            .reduce((acc: number, message: any) => acc + Math.ceil(message.content.length / 4), 0)
            .toLocaleString()
          console.warn(
            `${colors.red.bold('ERROR')} Rate limit error for this ${tokenCount} token prompt. Possibly past the token limit for this AI API. Try including fewer code files. Retrying in ${delay / 1000} seconds... (Attempt ${attempt} of ${maxRetries})`,
          )
          await new Promise((resolve) => setTimeout(resolve, delay))
          delay *= 2 // Exponential backoff
        } else {
          throw error
        }
      }
    }

    throw new Error('Max retries exceeded')
  }

  public async generateText(request: GPTRequest): Promise<string> {
    request.temperature ||= this.temperature

    const endpoint = this.adapter.getEndpoint(this.stream)
    const payload = this.adapter.getPayload(request, this.stream)
    const headers = this.adapter.getHeaders(this.apiKey)

    const reviewedPrompt = await this.reviewPrompt(request.prompt, request.messages || [], endpoint)
    if (reviewedPrompt === null) {
      throw new Error('Operation cancelled by user')
    }
    request.prompt = reviewedPrompt

    try {
      const response = await axios.post(endpoint, payload, { headers })
      return this.adapter.extractResponse(response.data)
    } catch (err) {
      const error = err as AxiosError
      let errorMessage = 'An error occurred while communicating with the AI server'

      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = `Server responded with status ${error.response.status}: ${error.response.statusText}`
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response received from the server'
      } else {
        // Something happened in setting up the request that triggered an Error
        errorMessage = error.message || 'Unknown error occurred'
      }

      console.error(
        `${colors.red.bold('ERROR')} ${errorMessage}\n` +
          `Endpoint: ${this.adapter.getEndpoint(this.stream)}\n` +
          `Details: ${colors.yellow(JSON.stringify(error.response?.data || {}, null, 2))}\n`,
      )

      throw new Error(errorMessage)
    }
  }

  convertStream(data: string): OpenAIStreamChunk | null {
    return this.adapter.convertStream(data)
  }
}

export default ClovingGPT
