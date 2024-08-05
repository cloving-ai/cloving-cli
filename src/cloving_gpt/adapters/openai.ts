import { Adapter } from '.'
import { GPTRequest } from '../../utils/types'

export class OpenAIAdapter implements Adapter {
  private model: string

  static supportedModels: string[] = [
    'openai:gpt:4o',
    'openai:gpt:4o-mini',
    'openai:gpt:4-turbo',
    'openai:gpt:3.5-turbo',
    'openai:text-embedding:3-large',
    // Add more supported models here as needed
  ]

  static listSupportedModels(): void {
    OpenAIAdapter.supportedModels.forEach(model => {
      console.log(model)
    })
  }

  constructor(model: string) {
    this.model = model
  }

  getEndpoint(): string {
    return `https://api.openai.com/v1/chat/completions`
  }

  getHeaders(apiKey: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  }

  getPayload(request: GPTRequest, stream: boolean = false): Record<string, any> {
    return {
      model: this.model.replace(':', '-'),
      messages: [{ role: "user", content: request.prompt }],
      max_tokens: request.maxTokens,
      temperature: request.temperature || 0.2,
      stream
    }
  }

  extractResponse(data: any): string {
    return data.choices[0].message.content
  }

  convertStream(data: string): string | null {
    return data
  }
}
