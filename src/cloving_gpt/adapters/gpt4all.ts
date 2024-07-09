import { Adapter } from '.'
import { GPTRequest } from '../../utils/types'

export class GPT4AllAdapter implements Adapter {
  private model: string

  constructor(model: string) {
    this.model = model
  }

  getEndpoint(): string {
    return `https://api.gpt4all.io/v1/models/${this.model}/completions`
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
    return data.text
  }
}
