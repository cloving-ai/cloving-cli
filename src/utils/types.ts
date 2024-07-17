export type GPTProvider = 'openai' | 'claude' | 'ollama' | 'gemini'

export interface GPTRequest {
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
}

export interface ClovingModelConfig {
  apiKey: string;
  primary: boolean;
  priority: number;
  silent: boolean;
  trust: boolean;
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
      [model: string]: ClovingModelConfig;
    };
  };
  globalSilent: boolean;
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