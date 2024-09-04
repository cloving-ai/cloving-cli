import { getConfig, saveConfig } from '../utils/config_utils'
import { fetchModels } from '../utils/prompt_utils'
import type { ClovingModelConfig } from '../utils/types'

// Add this type definition at the top of the file
import { select, input, confirm } from '@inquirer/prompts'

/**
 * Configures the AI models by prompting the user for various settings.
 *
 * @returns {Promise<void>} A promise that resolves when the configuration is complete.
 */
export const config = async (): Promise<void> => {
  let currentConfig = getConfig({})

  // Ensure models are initialized properly
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
    const providers = [...new Set(models.map((model) => model.split(':')[0]))]
    /**
     * Prompts the user to select a provider from the available models.
     */
    const selectedProvider = await select({
      message: 'Select a provider:',
      choices: providers.map((provider) => ({ name: provider, value: provider })),
    })

    const providerModels = models.filter((model) => model.startsWith(selectedProvider))
    const modelCategories = [...new Set(providerModels.map((model) => model.split(':')[1]))]
    /**
     * Prompts the user to select a category from the selected provider's models.
     */
    const selectedCategory = await select({
      message: 'Select a category:',
      choices: modelCategories.map((category) => ({ name: category, value: category })),
    })

    const specificModels = providerModels.filter(
      (model) => model.split(':')[1] === selectedCategory,
    )
    /**
     * Prompts the user to select a specific model from the selected category.
     */
    const modelIndex = await select({
      message: "Select an AI model you'd like to use:",
      choices: specificModels.map((model, index) => ({ name: model, value: index })),
      pageSize: specificModels.length,
    })

    const selectedModel = specificModels[modelIndex]
    /**
     * Prompts the user to enter the API key for the selected model.
     */
    const apiKey = await input({
      message: `Enter your API key for ${selectedModel}: `,
    })
    const [provider, ...modelParts] = selectedModel?.split(':') || []
    const model = modelParts.join(':')

    if (!currentConfig.models[provider]) {
      currentConfig.models[provider] = {}
    }

    /**
     * Prompts the user to set the selected model as the primary model.
     */
    const primary = await confirm({
      message:
        'Set this model as the primary? Primary models are used by default if your prompt fits within its context window. You can configure backup models for larger prompts.',
      default: true,
    })

    /**
     * Prompts the user to enter the priority for the selected model.
     *
     * @returns {string} The priority value as a string.
     */
    const priority = await input({
      message:
        'Enter the priority for this model (0-100). Higher priority AI APIs are chosen as long as the prompt fits its context window:',
      default: primary ? '100' : '0',
      validate: (input: string) => {
        const num = parseInt(input, 10)
        if (isNaN(num) || num < 0 || num > 100) {
          return 'Please enter a valid number between 0 and 100.'
        }
        return true
      },
    })

    /**
     * Prompts the user to decide if they want to review all prompts before they are sent to the selected model.
     */
    const review = await confirm({
      message: `Do you want to review all prompts before they are sent to ${selectedModel}?`,
      default: false,
    })

    /**
     * Prompts the user to decide if they trust the selected model with sensitive information.
     */
    const trust = await confirm({
      message: `Do you trust ${selectedModel} with sensitive information?`,
      default: true,
    })

    /**
     * Prompts the user to enter the temperature setting for the selected model.
     *
     * @returns {string} The temperature value as a string.
     */
    const temperature = await input({
      message: `Enter the temperature for ${selectedModel} (0.0 - 1.0): [0.2]`,
      default: '0.2',
      validate: (value: string) => {
        const num = parseFloat(value)
        if (isNaN(num) || num < 0 || num > 1) {
          return 'Please enter a valid number between 0.0 and 1.0.'
        }
        return true
      },
    })

    const parsedTemperature = parseFloat(temperature)

    /**
     * Constructs the model configuration object.
     */
    let modelConfig: ClovingModelConfig = {
      apiKey,
      primary,
      priority: parseInt(priority, 10),
      silent: !review,
      trust,
      temperature: parsedTemperature,
    }

    if (provider === 'azureopenai') {
      /**
       * Prompts the user to enter the Azure OpenAI endpoint URL.
       */
      const endpoint = await input({
        message: 'Enter the Azure OpenAI endpoint URL:',
        validate: (value: string) => {
          if (!value.startsWith('https://')) {
            return 'Please enter a valid HTTPS URL'
          }
          return true
        },
      })
      modelConfig.endpoint = endpoint
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

    /**
     * Prompts the user to decide if they want to configure another model.
     */
    const anotherModel = await confirm({
      message: 'Do you want to configure another model?',
      default: true,
    })

    continueConfig = anotherModel
  }

  saveConfig(currentConfig)
}

export default config
