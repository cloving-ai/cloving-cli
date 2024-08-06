import axios from 'axios'

import { Adapter } from '.'
import type { OpenAIStreamChunk, GPTRequest } from '../../utils/types'

export class OllamaAdapter implements Adapter {
  private model: string

  static supportedModels: string[] = []

  constructor(model: string) {
    this.model = model
  }

  static async listSupportedModels(): Promise<void> {
    try {
      const endpoint = 'http://localhost:11434/api/tags'
      const headers = {
        'Content-Type': 'application/json'
      }

      const response = await axios.get(endpoint, { headers })
      const data = response.data

      if (data && Array.isArray(data.models)) {
        OllamaAdapter.supportedModels = data.models.map((model: any) => `ollama:${model.name}`)
        OllamaAdapter.supportedModels.forEach(model => {
          console.log(model)
        })
      } else {
        console.error('Unexpected response structure:', data)
      }
    } catch (error) {
      // do nothing, no ollama server running
    }
  }

  getEndpoint(): string {
    return `http://localhost:11434/api/generate`
  }

  getHeaders(apiKey: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  }

  getPayload(request: GPTRequest, stream: boolean = false): Record<string, any> {
    return {
      model: this.model,
      prompt: request.prompt,
      stream
    }
  }

  extractResponse(data: any): string {
    try {
      if (data && typeof data === 'object' && 'response' in data) {
        return data.response
      } else {
        console.error('Unexpected response structure:', data)
        throw new Error('Invalid response structure')
      }
    } catch (error) {
      console.error('Error extracting response:', error)
      throw error
    }
  }

  // data example: 
  // {
  //   model: 'dolphin-llama3:latest',
  //   created_at: '2024-08-06T21:04:34.616355Z',
  //   response: 'The',
  //   done: false
  // }

  convertStream(data: string): OpenAIStreamChunk | null {
    let beginningChar = 0
    let lastChar = 0

    while (lastChar < data.length) {
      try {
        let remainingString = data.slice(beginningChar, lastChar)

        // Strip any leading characters until we encounter the first '{' in this block
        const firstBraceIndex = remainingString.indexOf('{')
        if (firstBraceIndex > -1) {
          remainingString = remainingString.slice(firstBraceIndex)
        }

        const parsedObject = JSON.parse(remainingString)
        const output = parsedObject?.response || ''

        return {
          output,
          lastChar
        }

      } catch (error) {
        // Incrementally increase the size of the JSON string to parse
        lastChar += 1
      }
    }

    return null
  }
}
