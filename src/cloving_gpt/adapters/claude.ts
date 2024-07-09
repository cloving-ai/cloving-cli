import { Adapter } from './Adapter'
import { GPTRequest } from '../../utils/types'

export class ClaudeAdapter implements Adapter {
  private model: string
  private anthropicVersion: string

  constructor(model: string) {
    this.model = model
    this.anthropicVersion = '2023-06-01'
  }

  getEndpoint(): string {
    return `https://api.anthropic.com/v1/messages`
  }

  getHeaders(apiKey: string): Record<string, string> {
    return {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': this.anthropicVersion
    }
  }

  getPayload(request: GPTRequest): Record<string, any> {
    return {
      model: this.model,
      system: 'You are using the Messages API',
      messages: [
        { role: 'user', content: request.prompt }
      ],
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.7
    }
  }

  extractResponse(data: any): string {
    try {
      if (data && data.content && Array.isArray(data.content) && data.content.length > 0) {
        return data.content.map((item: any) => item.text).join('\n')
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
