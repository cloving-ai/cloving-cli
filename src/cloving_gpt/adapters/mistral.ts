import { Adapter } from '.'
import type { OpenAIStreamChunk, GPTRequest } from '../../utils/types'

export class MistralAdapter implements Adapter {
  private model: string

  static supportedModels: string[] = [
    'mistral:mistral:embed',
    'mistral:mistral:tiny-latest',
    'mistral:mistral:small-latest',
    'mistral:mistral:medium-latest',
    'mistral:mistral:large-latest',
    'mistral:open-mistral:7b',
    'mistral:open-mixtral:8x7b',
    'mistral:open-mixtral:8x22b',
    'mistral:codestral:latest',
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

  getPayload(request: GPTRequest, stream: boolean = false): Record<string, any> {
    return {
      model: this.model.replace(':', '-'),
      messages: request.messages && request.messages.length > 0 ? request.messages : [{ role: "user", content: request.prompt }],
      max_tokens: request.maxTokens,
      temperature: request.temperature || 0.2,
      stream
    }
  }

  extractResponse(data: any): string {
    return data.choices[0].message.content
  }

  // data example: 
  //    {
  //      id: 'chatcmpl-9tL477A98d54qvVQqJT010bm8BLJl',
  //      object: 'chat.completion.chunk',
  //      created: 1722976043,
  //      model: 'gpt-4o-2024-05-13',
  //      system_fingerprint: 'fp_3aa7262c27',
  //      choices: [
  //          {
  //            "index": 0,
  //            "delta": {
  //              "content": " basic"
  //            },
  //            "logprobs": null,
  //            "finish_reason": null
  //          }
  //      ]
  //    }

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
        const output = parsedObject?.choices[0]?.delta?.content || ''

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
