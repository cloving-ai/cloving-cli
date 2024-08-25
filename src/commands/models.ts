import { ClaudeAdapter } from '../cloving_gpt/adapters/claude'
import { OpenAIAdapter } from '../cloving_gpt/adapters/openai'
import { OllamaAdapter } from '../cloving_gpt/adapters/ollama'
import { GeminiAdapter } from '../cloving_gpt/adapters/gemini'
import { MistralAdapter } from '../cloving_gpt/adapters/mistral'
import { AzureOpenAIAdapter } from '../cloving_gpt/adapters/azureopenai'

const listModels = async () => {
  ClaudeAdapter.listSupportedModels()
  GeminiAdapter.listSupportedModels()
  MistralAdapter.listSupportedModels()
  try {
    await OllamaAdapter.listSupportedModels()
  } catch (error) {
    // do nothing, no ollama server running
  }
  OpenAIAdapter.listSupportedModels()
  AzureOpenAIAdapter.listSupportedModels()
}

export default listModels
