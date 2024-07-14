export type Provider = 'openai' | 'claude' | 'gpt4all'

export interface GPTRequest {
  prompt: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface ClovingGPTOptions {
  silent: boolean
}

export type ClovingConfig = {
  models: Record<string, string>
  primaryModel?: string | null
}