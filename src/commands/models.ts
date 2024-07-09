// models.ts
import { ClaudeAdapter } from '../cloving_gpt/adapters/claude'
import { OpenAIAdapter } from '../cloving_gpt/adapters/openai'

const listModels = () => {
  console.log('Supported Models:')
  ClaudeAdapter.listSupportedModels()
  OpenAIAdapter.listSupportedModels()
}

export default listModels
