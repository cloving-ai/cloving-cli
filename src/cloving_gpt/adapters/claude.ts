// claude.ts
import { Adapter } from '.'
import { GPTRequest } from '../../utils/types'

export class ClaudeAdapter implements Adapter {
  private model: string
  private anthropicVersion: string

  static supportedModels: string[] = [
    'claude:claude-3-5-sonnet-20240620',
    'claude:claude-3-opus-20240229',
    'claude:claude-3-sonnet-20240229',
    'claude:claude-3-haiku-20240307',
    // Add more supported models here as needed
  ]

  constructor(model: string) {
    this.model = model
    this.anthropicVersion = '2023-06-01'
  }

  static listSupportedModels(): void {
    console.log('  - Anthropic Claude:')
    ClaudeAdapter.supportedModels.forEach(model => {
      console.log(`    - ${model}`)
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

  getPayload(request: GPTRequest): Record<string, any> {
    return {
      model: this.model,
      system: 'You are a computer programmer giving advice on how to write better code.',
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

// Example usage:
// ClaudeAdapter.listSupportedModels()
