export type Provider = 'openai' | 'claude' | 'gpt4all'

export interface GPTRequest {
  prompt: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface ClovingConfig {
  CLOVING_MODEL: string
  CLOVING_API_KEY: string
}

export interface ClovingGPTOptions {
  silent: boolean
}

