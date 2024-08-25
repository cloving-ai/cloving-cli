import { Adapter } from '.'
import type { GPTRequest, OpenAIStreamChunk } from '../../utils/types'

export class AzureOpenAIAdapter implements Adapter {
  private model: string
  private endpoint: string

  static supportedModels: string[] = [
    'azureopenai:gpt:4o-2024-08-06',
    'azureopenai:gpt:4o',
    'azureopenai:gpt:4o-mini',
    'azureopenai:gpt:4-turbo',
    'azureopenai:gpt:3.5-turbo',
    // Add more supported models as needed
  ]

  static listSupportedModels(): void {
    AzureOpenAIAdapter.supportedModels.forEach((model) => {
      console.log(model)
    })
  }

  constructor(model: string, endpoint: string) {
    this.model = model
    this.endpoint = endpoint
  }

  getEndpoint(): string {
    return this.endpoint
  }

  getHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  getPayload(request: GPTRequest, stream: boolean = false): Record<string, any> {
    return {
      model: this.model.replace('azureopenai:', '').replace(':', '-'),
      messages:
        request.messages && request.messages.length > 0
          ? request.messages
          : [{ role: 'user', content: request.prompt }],
      max_tokens: request.maxTokens,
      temperature: request.temperature || 0.2,
      stream,
    }
  }

  extractResponse(data: any): string {
    return data.choices[0].message.content
  }

  convertStream(data: string): OpenAIStreamChunk | null {
    let beginningChar = 0
    let lastChar = 0

    while (lastChar < data.length) {
      try {
        let remainingString = data.slice(beginningChar, lastChar)

        const firstBraceIndex = remainingString.indexOf('{')
        if (firstBraceIndex > -1) {
          remainingString = remainingString.slice(firstBraceIndex)
        }

        const parsedObject = JSON.parse(remainingString)
        const output = parsedObject?.choices[0]?.delta?.content || ''

        return {
          output,
          lastChar,
        }
      } catch (error) {
        lastChar += 1
      }
    }

    return null
  }
}
