import type { GPTRequest, OpenAIStreamChunk } from '../../utils/types'

/**
 * Interface defining the structure for GPT adapters.
 * This interface allows for different implementations of GPT API interactions.
 */
export interface Adapter {
  /**
   * Determines the appropriate endpoint URL based on whether streaming is enabled.
   * @param stream - Boolean indicating if streaming is enabled.
   * @returns The endpoint URL as a string.
   */
  getEndpoint(stream: boolean): string

  /**
   * Generates the necessary headers for the API request.
   * @param apiKey - The API key for authentication.
   * @returns An object containing the required headers.
   */
  getHeaders(apiKey: string): Record<string, string>

  /**
   * Prepares the payload for the API request.
   * @param request - The GPTRequest object containing the request details.
   * @param stream - Boolean indicating if streaming is enabled.
   * @returns An object representing the request payload.
   */
  getPayload(request: GPTRequest, stream: boolean): Record<string, any>

  /**
   * Extracts the response from the API data.
   * @param data - The raw data received from the API.
   * @returns The extracted response as a string.
   */
  extractResponse(data: any): string

  /**
   * Converts streaming data into an OpenAIStreamChunk object.
   * @param data - The raw streaming data as a string.
   * @returns An OpenAIStreamChunk object or null if conversion is not possible.
   */
  convertStream(data: string): OpenAIStreamChunk | null
}
