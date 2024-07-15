import { getConfig, saveConfig } from '../utils/config_utils'
import { promptUser, fetchModels } from '../utils/command_utils'
import type { ClovingModelConfig } from '../utils/types'

export const config = async (): Promise<void> => {
  let currentConfig = getConfig({})

  // Ensure models is initialized properly
  if (!currentConfig.models) {
    currentConfig.models = {}
  }

  const models = await fetchModels()
  if (models.length === 0) {
    console.error('No models available.')
    throw new Error('No models available')
  }

  let continueConfig = true

  while (continueConfig) {
    console.log('Available models:')
    models.forEach((model, index) => console.log(`${index + 1}. ${model}`))

    const modelIndex = parseInt(await promptUser('Select a model by number: '), 10) - 1
    if (isNaN(modelIndex) || modelIndex < 0 || modelIndex >= models.length) {
      throw new Error('Invalid selection')
    }

    const selectedModel = models[modelIndex]
    const apiKey = await promptUser(`Enter your API key for ${selectedModel}: `)
    const [provider, ...modelParts] = selectedModel.split(':')
    const model = modelParts.join(':')

    if (!currentConfig.models[provider]) {
      currentConfig.models[provider] = {}
    }

    const setAsPrimary = await promptUser('Do you want to use this model as a primary model? [Yn]: ')
    const primary = setAsPrimary.toLowerCase() === 'y' || setAsPrimary === ''

    const priority = primary ? 100 : parseInt(await promptUser('Enter the priority for this model (0-100, higher priority will be used as long as the prompt fits the context token limit): [' + (primary ? 100 : 0) + ']'), 100)

    const silentResponse = await promptUser('Do you want to review all prompts before they are sent to this model? [Yn]: ')
    const silent = !(silentResponse.toLowerCase() === 'y' || silentResponse === '')

    const trustResponse = await promptUser('Do you trust this model with sensitive information? [Yn]: ')
    const trust = trustResponse.toLowerCase() === 'y' || trustResponse === ''

    const modelConfig: ClovingModelConfig = {
      apiKey,
      primary,
      priority,
      silent,
      trust,
    }

    currentConfig.models[provider][model] = modelConfig

    if (primary) {
      // Ensure only one primary model
      for (const p in currentConfig.models) {
        for (const m in currentConfig.models[p]) {
          if (p !== provider || m !== model) {
            currentConfig.models[p][m].primary = false
          }
        }
      }
    }

    const anotherModel = await promptUser('Do you want to configure another model? [Yn]: ')
    if (anotherModel.toLowerCase() !== 'y' && anotherModel !== '') {
      continueConfig = false
    }
  }

  saveConfig(currentConfig)
}

export default config