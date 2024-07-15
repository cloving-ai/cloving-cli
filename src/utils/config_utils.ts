import os from 'os'
import path from 'path'
import fs from 'fs'
import ini from 'ini'

import type { ClovingConfig, ClovingGPTOptions, ClovingModelConfig, ClovingfileConfig } from '../utils/types'
export const CLOVING_CONFIG_PATH = path.join(os.homedir(), '.clovingconfig')
export const CLOVINGFILE_PATH = 'cloving.json'

export const getConfig = (options: ClovingGPTOptions): ClovingConfig => {
  try {
    if (fs.existsSync(CLOVING_CONFIG_PATH)) {
      const rawConfig = fs.readFileSync(CLOVING_CONFIG_PATH, 'utf-8')
      const config = ini.parse(rawConfig) as ClovingConfig
      if (options.silent) {
        config.globalSilent = true
      }
      return config
    }
  } catch (err) {
    console.error('Error reading configuration:', err)
  }

  if (process.env.CLOVING_MODEL) {
    const [provider, ...modelParts] = process.env.CLOVING_MODEL.split(':')
    const model = modelParts.join(':')
    return {
      models: {
        [provider]: {
          [model]: {
            apiKey: process.env.CLOVING_API_KEY ?? '',
            primary: true,
            priority: 10,
            silent: options.silent || false,
            trust: false
          }
        }
      },
      globalSilent: options.silent || false
    }
  } else {
    return { models: {}, globalSilent: options.silent || false }
  }
}

export const readClovingConfig = (): ClovingfileConfig => {
  if (fs.existsSync(CLOVINGFILE_PATH)) {
    const configFile = fs.readFileSync(CLOVINGFILE_PATH, 'utf-8')
    return ini.parse(configFile) as ClovingfileConfig
  } else {
    throw new Error('cloving.ini file not found')
  }
}

export const saveConfig = (config: ClovingConfig): void => {
  const iniString = ini.stringify(config)
  fs.writeFileSync(CLOVING_CONFIG_PATH, iniString)
  console.log(`Configuration saved to ${CLOVING_CONFIG_PATH}`)
}

export const getPrimaryModel = (): { provider: string, model: string, config: ClovingModelConfig } | null => {
  try {
    const config = getConfig({})
    for (const provider in config.models) {
      for (const model in config.models[provider]) {
        if (config.models[provider][model].primary) {
          return {
            provider,
            model,
            config: config.models[provider][model]
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading primary model from configuration:', err)
  }
  return null
}