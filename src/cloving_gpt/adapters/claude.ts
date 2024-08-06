import { Adapter } from '.'
import type { GPTRequest, OpenAIStreamChunk } from '../../utils/types'

export class ClaudeAdapter implements Adapter {
  private model: string
  private anthropicVersion: string

  static supportedModels: string[] = [
    'claude:claude-3-5:sonnet-20240620',
    'claude:claude-3:opus-20240229',
    'claude:claude-3:sonnet-20240229',
    'claude:claude-3:haiku-20240307',
    // Add more supported models here as needed
  ]

  constructor(model: string) {
    this.model = model
    this.anthropicVersion = '2023-06-01'
  }

  static listSupportedModels(): void {
    ClaudeAdapter.supportedModels.forEach(model => {
      console.log(model)
    })
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

  getPayload(request: GPTRequest, stream: boolean = false): Record<string, any> {
    return {
      model: this.model.replace(':', '-'),
      system: 'You are a computer programmer giving advice on how to write better code.',
      messages: [
        { role: 'user', content: request.prompt }
      ],
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.2,
      stream
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

  // data example: data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello, how are you?' } }
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
        const output = parsedObject?.delta?.text || ''

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
