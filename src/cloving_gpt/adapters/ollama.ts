// ollama.ts
import { Adapter } from '.'
import { GPTRequest } from '../../utils/types'

export class OllamaAdapter implements Adapter {
  private model: string

  static supportedModels: string[] = []

  constructor(model: string) {
    this.model = model
  }

  static async listSupportedModels(): Promise<void> {
    const endpoint = 'http://localhost:11434/api/tags'
    const headers = {
      'Content-Type': 'application/json'
    }

    await fetch(endpoint, {
      method: 'GET',
      headers
    })
      .then(response => response.json())
      .then(data => {
        if (data && Array.isArray(data.models)) {
          OllamaAdapter.supportedModels = data.models.map((model: any) => `ollama:${model.name}`)
          OllamaAdapter.supportedModels.forEach(model => {
            console.log(model)
          })
        } else {
          console.error('Unexpected response structure:', data)
        }
      })
      .catch(error => {
        console.error('Error fetching supported models:', error)
      })
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

  getPayload(request: GPTRequest): Record<string, any> {
    return {
      model: this.model,
      prompt: request.prompt,
      stream: request.stream ?? false
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
}
