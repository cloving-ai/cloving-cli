import { Adapter } from '.'
import { GPTRequest } from '../../utils/types'

export class MistralAdapter implements Adapter {
  private model: string

  static supportedModels: string[] = [
    'mistral:mistral:tiny-latest',
    'mistral:mistral:small-latest',
    'mistral:mistral:medium-latest',
    'mistral:mistral:large-latest',
    'mistral:mixtral:8x7b-latest',
  ]

  static listSupportedModels(): void {
    MistralAdapter.supportedModels.forEach(model => {
      console.log(model)
    })
  }

  constructor(model: string) {
    this.model = model
  }

  getEndpoint(): string {
    return 'https://api.mistral.ai/v1/chat/completions'
  }

  getHeaders(apiKey: string): Record<string, string> {
    return {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  }

  getPayload(request: GPTRequest): Record<string, any> {
    return {
      model: this.model.replace(':', '-'),
      messages: [{ role: "user", content: request.prompt }],
      max_tokens: request.maxTokens,
      temperature: request.temperature || 0.7,
      stream: false
    }
  }

  extractResponse(data: any): string {
    return data.choices[0].message.content
  }
}
