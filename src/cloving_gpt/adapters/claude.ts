import { Adapter } from '.'
import type { GPTRequest, OpenAIStreamChunk } from '../../utils/types'

/**
 * ClaudeAdapter class implements the Adapter interface for Claude AI models.
 */
export class ClaudeAdapter implements Adapter {
  private model: string
  private anthropicVersion: string

  /**
   * Array of supported Claude model identifiers.
   */
  static supportedModels: string[] = [
    'claude:claude-3-5:sonnet-20240620',
    'claude:claude-3:opus-20240229',
    'claude:claude-3:sonnet-20240229',
    'claude:claude-3:haiku-20240307',
    // Add more supported models here as needed
  ]

  /**
   * Initializes a new ClaudeAdapter instance.
   * @param model - The Claude model identifier.
   */
  constructor(model: string) {
    this.model = model
    this.anthropicVersion = '2023-06-01'
  }

  /**
   * Logs all supported Claude models to the console.
   */
  static listSupportedModels(): void {
    ClaudeAdapter.supportedModels.forEach((model) => {
      console.log(model)
    })
  }

  /**
   * Returns the API endpoint for Claude.
   * @returns The API endpoint URL.
   */
  getEndpoint(): string {
    return `https://api.anthropic.com/v1/messages`
  }

  /**
   * Generates headers for API requests.
   * @param apiKey - The API key for authentication.
   * @returns An object containing the required headers.
   */
  getHeaders(apiKey: string): Record<string, string> {
    return {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': this.anthropicVersion,
    }
  }

  /**
   * Prepares the payload for API requests.
   * @param request - The GPTRequest object containing request details.
   * @param stream - Whether to enable streaming (default: false).
   * @returns An object containing the prepared payload.
   */
  getPayload(request: GPTRequest, stream: boolean = false): Record<string, any> {
    let system = 'You are a computer programmer giving advice on how to write better code.'
    if (request.messages && request.messages.length > 0 && request.messages[0].role === 'system') {
      system = request.messages[0].content
      request = { ...request, messages: request.messages.slice(1) }
    }
    return {
      model: this.model.replace(':', '-'),
      system,
      messages:
        request.messages && request.messages.length > 0
          ? request.messages
          : [{ role: 'user', content: request.prompt }],
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature || 0.2,
      stream,
    }
  }

  /**
   * Extracts the response text from the API response data.
   * @param data - The API response data.
   * @returns The extracted response text.
   * @throws Error if the response structure is invalid.
   */
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

  /**
   * Converts streaming data to OpenAIStreamChunk format.
   * @param data - The streaming data string.
   * @returns An OpenAIStreamChunk object or null if parsing fails.
   */
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
          lastChar,
        }
      } catch (error) {
        // Incrementally increase the size of the JSON string to parse
        lastChar += 1
      }
    }

    return null
  }
}
