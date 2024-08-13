import { Adapter } from '.'
import type { OpenAIStreamChunk, GPTRequest } from '../../utils/types'

export class GeminiAdapter implements Adapter {
  private model: string

  static supportedModels: string[] = [
    'gemini:gemini-1.5:pro-latest',
    'gemini:gemini-1.5:flash-latest',
    'gemini:gemini-1.0:pro-latest',
  ]

  constructor(model: string) {
    this.model = model
  }

  static async listSupportedModels(): Promise<void> {
    GeminiAdapter.supportedModels.forEach(model => {
      console.log(model)
    })
  }

  getEndpoint(stream: boolean = false): string {
    if (stream) {
      return `https://generativelanguage.googleapis.com/v1beta/models/${this.model.replace(':', '-')}:streamGenerateContent`
    } else {
      return `https://generativelanguage.googleapis.com/v1beta/models/${this.model.replace(':', '-')}:generateContent`
    }
  }

  getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    }
  }

  getPayload(request: GPTRequest, stream: boolean = false): Record<string, any> {
    return {
      contents: [
        {
          role: 'user', // or 'model' if generated from the model
          parts: [
            {
              text: request.prompt
            }
          ]
        },
      ],
      generationConfig: {
        temperature: request.temperature || 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024
      }
    }
  }

  extractResponse(data: any): string {
    try {
      if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text
      } else {
        console.error('Unexpected response structure:', data)
        throw new Error('Invalid response structure')
      }
    } catch (error) {
      console.error('Error extracting response:', error)
      throw error
    }
  }

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
        const output = parsedObject?.candidates[0]?.content?.parts[0]?.text || ''

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
