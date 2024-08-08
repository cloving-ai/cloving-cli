import fs from 'fs'
import os from 'os'
import path from 'path'
import axios, { AxiosResponse, AxiosError } from 'axios'
import { spawn } from 'child_process'
import process from 'process'
import { confirm } from '@inquirer/prompts'

import { Adapter } from './adapters/'
import { ClaudeAdapter } from './adapters/claude'
import { OpenAIAdapter } from './adapters/openai'
import { MistralAdapter } from './adapters/mistral'
import { OllamaAdapter } from './adapters/ollama'
import { GeminiAdapter } from './adapters/gemini'
import { getConfig, getPrimaryModel } from '../utils/config_utils'

import type { OpenAIStreamChunk, GPTRequest, ClovingGPTOptions, ClovingConfig } from '../utils/types'

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
    this.silent = options.silent || modelConfig.silent
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
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  }

  private async reviewPrompt(prompt: string, endpoint: string): Promise<string | null> {
    if (this.silent) return prompt

    const tokenCount = Math.ceil(prompt.length / 4).toLocaleString()
    const reviewPrompt = await confirm(
      {
        message: `Do you want to review/edit the ~${tokenCount} token prompt before sending it to ${endpoint}?`,
        default: true
      }
    )

    if (reviewPrompt) {
      const tempFile = path.join(os.tmpdir(), `cloving_prompt_${Date.now()}.txt`)
      fs.writeFileSync(tempFile, prompt)

      const editor = process.env.EDITOR || 'nano'
      const editProcess = spawn(editor, [tempFile], { stdio: 'inherit' })

      return new Promise<string | null>((resolve, reject) => {
        editProcess.on('close', async (code) => {
          if (code !== 0) {
            console.error(`${editor} exited with code ${code}`)
            fs.unlinkSync(tempFile)
            reject(new Error(`Editor exited with non-zero code`))
            return
          }

          const editedPrompt = fs.readFileSync(tempFile, 'utf-8').trim()
          fs.unlinkSync(tempFile)

          if (editedPrompt === '') {
            console.log('Prompt is empty.')
            resolve(null)
            return
          }

          resolve(editedPrompt)
        })

        editProcess.on('error', (err) => {
          console.error('Error launching editor:', err)
          fs.unlinkSync(tempFile)
          reject(err)
        })
      })
    }

    return prompt
  }

  public async streamText(request: GPTRequest): Promise<AxiosResponse> {
    request.stream = true
    request.temperature ||= this.temperature

    const endpoint = this.adapter.getEndpoint(this.stream)
    const payload = this.adapter.getPayload(request, this.stream)
    const headers = this.adapter.getHeaders(this.apiKey)

    const reviewedPrompt = await this.reviewPrompt(request.prompt, endpoint)
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
          timeout: this.timeout
        })
      } catch (err) {
        const error = err as AxiosError
        if (error.response && error.response.status === 429) {
          attempt++
          const tokenCount = payload.messages.reduce((acc: number, message: any) => acc + Math.ceil(message.content.length / 4), 0).toLocaleString()
          console.warn(`Rate limit error for this ${tokenCount} token prompt. Possibly past the token limit for this AI API. Try including fewer code files. Retrying in ${delay / 1000} seconds... (Attempt ${attempt} of ${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, delay))
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

    const reviewedPrompt = await this.reviewPrompt(request.prompt, endpoint)
    if (reviewedPrompt === null) {
      throw new Error('Operation cancelled by user')
    }
    request.prompt = reviewedPrompt

    try {
      const response = await axios.post(endpoint, payload, { headers })
      return this.adapter.extractResponse(response.data)
    } catch (err) {
      const error = err as AxiosError
      let errorMessage = error instanceof Error ? error.message : 'connection error'
      if (errorMessage === '') {
        errorMessage = 'connection error'
      }
      console.error(`Error communicating with the GPT server (${this.adapter.getEndpoint(this.stream)}): ${errorMessage}\n${error.response?.data}`)
      throw error
    }
  }

  convertStream(data: string): OpenAIStreamChunk | null {
    return this.adapter.convertStream(data)
  }
}

export default ClovingGPT
