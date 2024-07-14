import { promptUser, fetchModels, getConfig, saveConfig } from '../utils/command_utils'

export const config = async () => {
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
    if (modelIndex < 0 || modelIndex >= models.length) {
      console.error('Invalid selection.')
      throw new Error('Invalid selection')
    }

    const selectedModel = models[modelIndex]
    const apiKey = await promptUser(`Enter your API key for ${selectedModel}: `)

    currentConfig.models[selectedModel] = apiKey

    const setAsPrimary = await promptUser('Do you want to set this model as the primary model? [Yn]: ')
    if (setAsPrimary.toLowerCase() === 'y' || setAsPrimary === '') {
      currentConfig.primaryModel = selectedModel
    }

    const anotherModel = await promptUser('Do you want to configure another model? [Yn]: ')
    if (anotherModel.toLowerCase() !== 'y' && anotherModel !== '') {
      continueConfig = false
    }
  }

  saveConfig(currentConfig)
}

export default config