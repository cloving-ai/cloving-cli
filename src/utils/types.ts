export type Provider = 'openai' | 'claude' | 'gpt4all'

export interface GPTRequest {
  prompt: string
  maxTokens?: number
  temperature?: number
}

