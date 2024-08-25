import axios from 'axios'

import { Adapter } from '.'
import type { OpenAIStreamChunk, GPTRequest } from '../../utils/types'

/**
 * Adapter for interacting with the Ollama API.
 */
export class OllamaAdapter implements Adapter {
  private model: string

  static supportedModels: string[] = []

  /**
   * Constructor to initialize the OllamaAdapter with a specific model.
   * @param model - The model to be used by the adapter.
   */
  constructor(model: string) {
    this.model = model
  }

  /**
   * Fetches and lists supported models from the Ollama API.
   */
  static async listSupportedModels(): Promise<void> {
    try {
      const endpoint = 'http://localhost:11434/api/tags'
      const headers = {
        'Content-Type': 'application/json',
      }

      const response = await axios.get(endpoint, { headers })
      const data = response.data

      if (data && Array.isArray(data.models)) {
        OllamaAdapter.supportedModels = data.models.map((model: any) => `ollama:${model.name}`)
        OllamaAdapter.supportedModels.forEach((model) => {
          console.log(model)
        })
      } else {
        console.error('Unexpected response structure:', data)
      }
    } catch (error) {
      // do nothing, no ollama server running
    }
  }

  /**
   * Returns the endpoint URL for generating responses.
   * @returns The endpoint URL as a string.
   */
  getEndpoint(): string {
    return `http://localhost:11434/api/generate`
  }

  /**
   * Returns the headers required for making API requests.
   * @param apiKey - The API key for authorization.
   * @returns An object containing the headers.
   */
  getHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Constructs the payload for the API request.
   * @param request - The GPT request object containing the prompt.
   * @param stream - Boolean indicating if the response should be streamed.
   * @returns An object containing the payload.
   */
  getPayload(request: GPTRequest, stream: boolean = false): Record<string, any> {
    return {
      model: this.model,
      prompt: request.prompt,
      stream,
    }
  }

  /**
   * Extracts the response from the API response data.
   * @param data - The response data from the API.
   * @returns The extracted response as a string.
   * @throws Will throw an error if the response structure is invalid.
   */
  extractResponse(data: any): string {
    try {
      if (data && typeof data === 'object' && 'response' in data) {
        return data.response
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
   * Converts a stream of data into an OpenAIStreamChunk.
   * @param data - The string data to be converted.
   * @returns An OpenAIStreamChunk object or null if conversion fails.
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
        const output = parsedObject?.response || ''

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
