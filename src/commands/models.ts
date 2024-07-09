// models.ts
import { ClaudeAdapter } from '../cloving_gpt/adapters/claude'
import { OpenAIAdapter } from '../cloving_gpt/adapters/openai'
import { OllamaAdapter } from '../cloving_gpt/adapters/ollama'

const listModels = async () => {
  await OllamaAdapter.listSupportedModels()
  ClaudeAdapter.listSupportedModels()
  OpenAIAdapter.listSupportedModels()
}

export default listModels
