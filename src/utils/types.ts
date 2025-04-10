export type GPTProvider = 'openai' | 'claude' | 'ollama' | 'gemini'

export interface BlockIndices {
  start: number
  current: number
  filePathEnd: number
  divider: number
  end: number
}

export interface OpenAIStreamChunk {
  output: string
  lastChar: number
}

export interface CurrentNewBlock {
  language: string
  filePath: string
  currentContent: string
  newContent: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface GPTRequest {
  messages?: ChatMessage[]
  prompt: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
}

export interface ClovingGPTOptions {
  model?: string
  silent?: boolean
  files?: string[]
  prompt?: string
  save?: boolean
  exec?: boolean
  interactive?: boolean
  temperature?: number
  port?: number
  stream?: boolean
  timeout?: number
  autoAccept?: boolean
}

export interface ClovingModelConfig {
  apiKey: string
  primary: boolean
  priority: number
  silent: boolean
  trust: boolean
  temperature: number
  endpoint?: string
}

export type ProjectConfig = {
  name: string
  task: string
  files?: string[]
  plan?: Record<string, any>
}

export type ClovingConfig = {
  models: {
    [provider: string]: {
      [model: string]: ClovingModelConfig
    }
  }
  globalSilent: boolean
}

interface LanguageConfig {
  name: string
  version?: string
  primary?: boolean
  directory: string
  extension: string
}

interface FrameworkConfig {
  name: string
  type: string
  version?: string
  primary?: boolean
  directory?: string
  extension?: string
}

interface TestingFrameworkConfig {
  name: string
  type: string
  version?: string
  directory?: string
  runCommand?: string
}

interface BuildToolConfig {
  name: string
  type: string
  version?: string
}

interface LinterConfig {
  name: string
  version?: string
  type?: string
}

interface DatabaseConfig {
  name: string
  primary?: boolean
}

export interface ClovingfileConfig {
  languages: LanguageConfig[]
  frameworks: FrameworkConfig[]
  testingFrameworks?: TestingFrameworkConfig[]
  buildTools: BuildToolConfig[]
  packageManager: string
  linters: LinterConfig[]
  databases?: DatabaseConfig[]
  projectType: string
}
