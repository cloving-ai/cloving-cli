import { randomBytes } from 'crypto'
import { Adapter } from '.'
import { GPTRequest } from '../../utils/types'

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

  // input example: {"type": "completion", "completion": " Hello", "stop_reason": null, "model": "claude-2.0"}
  // output example: {"id":"chatcmpl-9svCVWp4OnkwlmOfKSwDiCT3gp0sJ","object":"chat.completion.chunk","created":1722876619,"model":"gpt-4o-2024-05-13","system_fingerprint":"fp_4e2b2da518","choices":[{"index":0,"delta":{"content":" Hello"},"logprobs":null,"finish_reason":null}]}
  convertStream(data: string): string | null {
    const pieces = data.split('data: ').map(piece => {
      // find the { } in the input string
      const firstBracket = piece.indexOf('{')
      const lastBracket = piece.lastIndexOf('}')
      const jsonData = piece.slice(firstBracket, lastBracket + 1)

      // Parse the input string into an object
      let parsedData = {} as any
      try {
        parsedData = JSON.parse(jsonData)
      } catch (error) {
        parsedData = { type: 'ping' }
      }

      // Destructure necessary fields from input
      const { type, delta, stop_reason, model, message } = parsedData

      if (type === 'content_block_delta') {
        // Build the output object structure
        const dataObject = {
          id: `chatcmpl-9svvv3j9Xat1HCcNy5eknFVFIpj04`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model,
          system_fingerprint: `fp_3cd8b62c3b`,
          choices: [
            {
              index: 0,
              delta: {
                content: delta.text
              },
              logprobs: null,
              finish_reason: stop_reason
            }
          ]
        }

        return JSON.stringify(dataObject)
      } else if (type === 'message_start') {
        // Build the output object structure
        const dataObject = {
          id: `chatcmpl-9svvv3j9Xat1HCcNy5eknFVFIpj04`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'cloving',
          system_fingerprint: `fp_3cd8b62c3b`,
          choices: [
            {
              index: 0,
              delta: {
                role: message.role,
                content: message.content[0] || ""
              },
              logprobs: null,
              finish_reason: null
            }
          ]
        }

        return JSON.stringify(dataObject)
      } else if (type === 'content_block_delta') {
        // Build the output object structure
        const dataObject = {
          id: `chatcmpl-9svvv3j9Xat1HCcNy5eknFVFIpj04`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'cloving',
          system_fingerprint: `fp_3cd8b62c3b`,
          choices: [
            {
              index: 0,
              delta: {
                content: delta.text
              },
              logprobs: null,
              finish_reason: stop_reason
            }
          ]
        }

        return JSON.stringify(dataObject)
      } else {
        return null
      }
    })

    const output = 'data: ' + pieces.filter(piece => piece !== null).join('\n\ndata: ') + '\n\n'

    if (pieces.filter(piece => piece !== null).length === 0) {
      return null
    } else {
      // Return the stringified output object
      return output
    }
  }
}
