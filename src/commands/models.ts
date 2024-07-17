import { ClaudeAdapter } from '../cloving_gpt/adapters/claude'
import { OpenAIAdapter } from '../cloving_gpt/adapters/openai'
import { OllamaAdapter } from '../cloving_gpt/adapters/ollama'
import { GeminiAdapter } from '../cloving_gpt/adapters/gemini'

const listModels = async () => {
  try {
    await OllamaAdapter.listSupportedModels()
  } catch (error) {
    // do nothing, no ollama server running
  }
  ClaudeAdapter.listSupportedModels()
  OpenAIAdapter.listSupportedModels()
  GeminiAdapter.listSupportedModels()
}

export default listModels
