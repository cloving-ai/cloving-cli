import { GPTRequest } from '../../utils/types'

export interface Adapter {
  getEndpoint(): string
  getHeaders(apiKey: string): Record<string, string>
  getPayload(request: GPTRequest): Record<string, any>
  extractResponse(data: any): string
}
