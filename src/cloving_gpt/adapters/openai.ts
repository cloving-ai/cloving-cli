import { Adapter } from './Adapter'
import { GPTRequest } from '../../utils/types'

export class OpenAIAdapter implements Adapter {
  private model: string

  constructor(model: string) {
    this.model = model
  }

  getEndpoint(): string {
    return `https://api.openai.com/v1/engines/${this.model}/completions`
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
      max_tokens: request.maxTokens,
      temperature: request.temperature || 0.7
    }
  }

  extractResponse(data: any): string {
    return data.choices[0].text
  }
}
