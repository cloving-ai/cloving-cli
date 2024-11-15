/**
 * @file Configuration utilities for Cloving
 * @module config_utils
 */

import os from 'os'
import path from 'path'
import fs from 'fs'
import ini from 'ini'
import { execFileSync } from 'child_process'

import ClovingGPT from '../cloving_gpt'
import type {
  ClovingConfig,
  ClovingGPTOptions,
  ClovingModelConfig,
  ClovingfileConfig,
  ProjectConfig,
} from '../utils/types'

/** Path to the global Cloving configuration file */
export const CLOVING_CONFIG_PATH = path.join(os.homedir(), '.clovingconfig')
/** Name of the local Cloving configuration file */
export const CLOVINGFILE_PATH = 'cloving.json'
/** Path to the Cloving projects directory */
export const CLOVINGPROJECT_PATH = '.clovingprojects'

/** Cached Cloving configuration */
let clovingConfig: ClovingfileConfig

/**
 * Retrieves the Cloving configuration
 * @param {ClovingGPTOptions} options - Options for ClovingGPT
 * @returns {ClovingConfig} The Cloving configuration
 */
export const getConfig = (options: ClovingGPTOptions): ClovingConfig => {
  try {
    if (fs.existsSync(CLOVING_CONFIG_PATH)) {
      const rawConfig = fs.readFileSync(CLOVING_CONFIG_PATH, 'utf-8')
      const config = ini.parse(rawConfig) as ClovingConfig
      if (options.silent) {
        config.globalSilent = true
      }

      // Parse temperature to float if it exists in the config
      for (const provider in config.models) {
        for (const model in config.models[provider]) {
          if (config.models[provider][model].temperature !== undefined) {
            const temp = config.models[provider][model].temperature
            config.models[provider][model].temperature =
              typeof temp === 'string' ? parseFloat(temp) : temp
          }
        }
      }

      return config
    }
  } catch (err) {
    console.error('Error reading configuration:', err)
  }

  // Fallback to environment variables if config file doesn't exist
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
            trust: false,
            temperature: options.temperature || 0.2,
          },
        },
      },
      globalSilent: options.silent || false,
    }
  } else {
    return { models: {}, globalSilent: options.silent || false }
  }
}

/**
 * Retrieves the local Cloving configuration
 * @returns {ClovingfileConfig} The local Cloving configuration
 * @throws {Error} If the cloving.json file is not found
 */
export const getClovingConfig = (): ClovingfileConfig => {
  if (clovingConfig) {
    return clovingConfig
  } else if (fs.existsSync(CLOVINGFILE_PATH)) {
    clovingConfig = getClovingConfigAtPath(CLOVINGFILE_PATH)
    return clovingConfig
  } else {
    console.log(`${CLOVINGFILE_PATH} file not found, please run: cloving init`)
    process.exit(1)
  }
}

const getClovingConfigAtPath = (fullPath: string): ClovingfileConfig => {
  const configFile = fs.readFileSync(fullPath, 'utf-8')
  return JSON.parse(configFile) as ClovingfileConfig
}

export const getNearestClovingConfig = (): { config: ClovingfileConfig; path: string } => {
  let runPath = process.cwd()
  const parts = runPath.split(path.sep)
  while (parts.length > 0) {
    const configPath = path.join(parts.join(path.sep), CLOVINGFILE_PATH)
    if (fs.existsSync(configPath)) {
      clovingConfig = getClovingConfigAtPath(configPath)
      return { config: clovingConfig, path: configPath }
    }
    parts.pop()
  }
  throw new Error(`No ${CLOVINGFILE_PATH} file found in ${runPath} or any parent directory`)
}

/**
 * Saves the Cloving configuration to the config file
 * @param {ClovingConfig} config - The configuration to save
 */
export const saveConfig = (config: ClovingConfig): void => {
  const iniString = ini.stringify(config)
  fs.writeFileSync(CLOVING_CONFIG_PATH, iniString)
  console.log(`Configuration saved to ${CLOVING_CONFIG_PATH}`)
}

/**
 * Retrieves the primary model configuration
 * @param {string} [partialModel] - Partial model name to filter by
 * @returns {Object | null} The primary model configuration or null if not found
 */
export const getPrimaryModel = (
  partialModel?: string,
): { provider: string; model: string; config: ClovingModelConfig } | null => {
  try {
    const config = getConfig({})
    const models: { provider: string; model: string; config: ClovingModelConfig }[] = []

    for (const provider in config.models) {
      for (const model in config.models[provider]) {
        if (!partialModel || `${provider}:${model}`.startsWith(partialModel)) {
          models.push({
            provider,
            model,
            config: config.models[provider][model],
          })
        }
      }
    }

    models.sort(
      (a, b) => parseInt(`${b.config.priority}`, 10) - parseInt(`${a.config.priority}`, 10),
    )

    return models.length > 0 ? models[0] : null
  } catch (err) {
    console.error('Error reading model from configuration:', err)
    return null
  }
}

/**
 * Retrieves the configuration for a specific project
 * @param {string} name - The name of the project
 * @returns {ProjectConfig} The project configuration
 * @throws {Error} If the project configuration file is not found
 */
export const getProjectConfig = (name: string): ProjectConfig => {
  const projectConfigPath = path.join(CLOVINGPROJECT_PATH, name, 'config.ini')
  if (fs.existsSync(projectConfigPath)) {
    const configFile = fs.readFileSync(projectConfigPath, 'utf-8')
    return ini.parse(configFile) as ProjectConfig
  } else {
    throw new Error(`${projectConfigPath} file not found`)
  }
}

/**
 * Saves the configuration for a specific project
 * @param {string} name - The name of the project
 * @param {ProjectConfig} config - The project configuration to save
 */
export const saveProjectConfig = (name: string, config: ProjectConfig): void => {
  const projectConfigPath = path.join(CLOVINGPROJECT_PATH, name, 'config.ini')
  const projectConfigDir = path.dirname(projectConfigPath)

  // Create directory if it doesn't exist
  if (!fs.existsSync(projectConfigDir)) {
    fs.mkdirSync(projectConfigDir, { recursive: true })
  }

  const iniString = ini.stringify(config)
  fs.writeFileSync(projectConfigPath, iniString)
  console.log(`Configuration saved to ${projectConfigPath}`)
}

/**
 * Removes the configuration file for a specific project
 * @param {string} name - The name of the project
 */
export const removeProjectConfig = (name: string): void => {
  const projectConfigPath = path.join(CLOVINGPROJECT_PATH, name, 'config.ini')
  if (fs.existsSync(projectConfigPath)) {
    fs.unlinkSync(projectConfigPath)
    console.log(`Project completed and file removed: ${projectConfigPath}`)
  } else {
    console.error(`Configuration not found: ${projectConfigPath}`)
  }
}

const setupTestingPrompt = async (gpt: ClovingGPT, config: ClovingfileConfig) => {
  const prompt = `I have the following cloving.json configuration file:

==== begin cloving.json ====
${JSON.stringify(config, null, 2)}
==== end cloving.json ====

Please provide instructions on how to set up testing for this project.`

  const setupInstructions = await gpt.generateText({ prompt })

  console.log(setupInstructions)
  process.exit(0)
}

export const getAllFiles = async (
  options: ClovingGPTOptions,
  forTesting: boolean,
): Promise<string[]> => {
  const gpt = new ClovingGPT(options)

  // Read the cloving.json file
  const { config } = getNearestClovingConfig()
  const testingDirectory = getTestingDirectory()

  let allSrcFiles: string[] = []

  if (forTesting && !testingDirectory) {
    await setupTestingPrompt(gpt, config)
  }

  // Collect srcFiles for each language with specified directory and extension
  for (const language of config.languages) {
    if (language.directory && language.extension) {
      const srcFiles = execFileSync('find', [
        language.directory,
        '-type',
        'f',
        '-name',
        `*${language.extension}`,
      ])
        .toString()
        .trim()
        .split('\n')
      allSrcFiles = allSrcFiles.concat(srcFiles)
    }
  }

  // Ensure allSrcFiles is unique
  return Array.from(new Set(allSrcFiles))
}

export const getTestingDirectory = (): string | undefined => {
  const config = getClovingConfig()
  return config.testingFrameworks?.find((framework: any) => framework.directory)?.directory
}
