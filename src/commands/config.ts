import fs from 'fs'
import os from 'os'
import path from 'path'
import readline from 'readline'
import { runCommand } from '../utils/command_utils'
import type { ClovingConfig } from '../utils/types'

const CONFIG_PATH = path.join(os.homedir(), '.cloving.json')

const promptUser = (question: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

const saveConfig = (config: ClovingConfig) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  console.log(`Configuration saved to ${CONFIG_PATH}`)
}

export const getConfig = async (): Promise<ClovingConfig | null> => {
  if (fs.existsSync(CONFIG_PATH)) {
    const rawConfig = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(rawConfig)
  }
  return null
}

const fetchModels = async (): Promise<string[]> => {
  try {
    const modelsOutput = await runCommand('cloving', ['models'])
    return modelsOutput
  } catch (error) {
    console.error('Error fetching models:', (error as Error).message)
    return []
  }
}

export const config = async () => {
  const models = await fetchModels()
  if (models.length === 0) {
    console.error('No models available.')
    throw new Error('No models available')
  }

  console.log('Available models:')
  models.forEach((model, index) => console.log(`${index + 1}. ${model}`))

  const modelIndex = parseInt(await promptUser('Select a model by number: '), 10) - 1
  if (modelIndex < 0 || modelIndex >= models.length) {
    console.error('Invalid selection.')
    throw new Error('Invalid selection')
  }

  const selectedModel = models[modelIndex]
  const apiKey = await promptUser('Enter your API key: ')

  const config: ClovingConfig = { CLOVING_MODEL: selectedModel, CLOVING_API_KEY: apiKey }
  saveConfig(config)
}

export default config
