import { Adapter } from '.'
import type { OpenAIStreamChunk, GPTRequest } from '../../utils/types'

/**
 * GeminiAdapter class implements the Adapter interface for Google's Gemini AI model.
 */
export class GeminiAdapter implements Adapter {
  private model: string

  static supportedModels: string[] = [
    'gemini:gemini-1.5:pro-latest',
    'gemini:gemini-1.5:flash-latest',
    'gemini:gemini-1.0:pro-latest',
  ]

  /**
   * Creates a new GeminiAdapter instance.
   * @param model - The Gemini model to use.
   */
  constructor(model: string) {
    this.model = model
  }

  /**
   * Lists all supported Gemini models to the console.
   */
  static async listSupportedModels(): Promise<void> {
    GeminiAdapter.supportedModels.forEach((model) => {
      console.log(model)
    })
  }

  /**
   * Gets the appropriate API endpoint URL based on whether streaming is required.
   * @param stream - Whether to use streaming endpoint.
   * @returns The API endpoint URL.
   */
  getEndpoint(stream: boolean = false): string {
    if (stream) {
      return `https://generativelanguage.googleapis.com/v1beta/models/${this.model.replace(':', '-')}:streamGenerateContent`
    } else {
      return `https://generativelanguage.googleapis.com/v1beta/models/${this.model.replace(':', '-')}:generateContent`
    }
  }

  /**
   * Generates headers for the API request.
   * @param apiKey - The API key for authentication.
   * @returns An object containing the necessary headers.
   */
  getHeaders(apiKey: string): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    }
  }

  /**
   * Prepares the payload for the API request.
   * @param request - The GPTRequest object containing prompt and other parameters.
   * @param stream - Whether the request is for streaming.
   * @returns The formatted payload object.
   */
  getPayload(request: GPTRequest, stream: boolean = false): Record<string, any> {
    return {
      contents: [
        {
          role: 'user', // or 'model' if generated from the model
          parts: [
            {
              text: request.prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: request.temperature || 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    }
  }

  /**
   * Extracts the response text from the API response data.
   * @param data - The raw API response data.
   * @returns The extracted response text.
   * @throws Error if the response structure is invalid.
   */
  extractResponse(data: any): string {
    try {
      if (
        data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0]
      ) {
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

  /**
   * Converts a stream chunk to an OpenAIStreamChunk format.
   * @param data - The raw stream chunk data.
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
        const output = parsedObject?.candidates[0]?.content?.parts[0]?.text || ''

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
