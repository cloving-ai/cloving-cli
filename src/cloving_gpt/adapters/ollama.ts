import { Adapter } from '.'
import { GPTRequest } from '../../utils/types'
import axios from 'axios'

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

  convertStream(data: string): string | null {
    return data
  }
}
