import fs from 'fs'
import os from 'os'
import path from 'path'
import { promises as fsPromises } from 'fs'
import { confirm } from '@inquirer/prompts'
import ClovingGPT from '../cloving_gpt'
import ignore from 'ignore'
import { extractJsonMetadata } from '../utils/string_utils'
import { getConfig } from '../utils/config_utils'
import {
  generateFileList,
  collectSpecialFileContents,
  checkForSpecialFiles,
  INIT_INSTRUCTIONS,
} from '../utils/prompt_utils'
import type { ClovingGPTOptions, ChatMessage, ClovingfileConfig } from '../utils/types'

class InitManager {
  private gpt: ClovingGPT
  private chatHistory: ChatMessage[] = []

  constructor(private options: ClovingGPTOptions) {
    this.options.silent = getConfig(this.options).globalSilent || false
    this.gpt = new ClovingGPT(this.options)
    this.chatHistory.push({
      role: 'system',
      content: INIT_INSTRUCTIONS,
    })
  }

  /**
   * Initializes the InitManager by collecting special file contents, checking for dependencies,
   * and processing the AI response for the project details.
   *
   * @return {Promise<void>} A promise that resolves when the initialization is complete.
   */
  public async initialize(): Promise<void> {
    const specialFileContents = collectSpecialFileContents()
    const specialFileNames = Object.keys(specialFileContents).map((file) => ' - ' + file)

    this.logInitializationMessage(specialFileNames)

    const config = getConfig(this.options)
    if (!config || !config?.models) {
      console.error('No cloving configuration found. Please run `cloving config`')
      return
    }

    if (!checkForSpecialFiles()) {
      console.error(
        'No dependencies files detected. Please add a dependency file (e.g. package.json, Gemfile, requirements.txt, etc.) to your project and run `cloving init` again.',
      )
      return
    }

    const tempFilePath = path.join(os.tmpdir(), `describe_${Date.now()}.tmp`)

    try {
      const limitedFileList = await this.getFilteredFileList()

      const projectDetails = {
        files: limitedFileList,
        specialFiles: specialFileContents,
      }

      await this.processAIResponse(projectDetails, tempFilePath)

      await this.promptUserForReview()

      // Clean up
      await fsPromises.unlink(tempFilePath)
    } catch (error) {
      console.error('Error describing the project:', (error as Error).message)
    }
  }

  /**
   * Checks if a directory exists at the specified path.
   *
   * @param {string} directory - The path of the directory to check.
   * @return {Promise<boolean>} A promise that resolves to true if the directory exists, false otherwise.
   */
  private async directoryExists(directory: string): Promise<boolean> {
    try {
      const stats = await fsPromises.stat(directory)
      return stats.isDirectory()
    } catch (error) {
      return false
    }
  }

  /**
   * Returns a filtered list of files, excluding those ignored by the .gitignore file.
   *
   * @return {string[]} A list of file paths, limited to the first 100 files.
   */
  private async getFilteredFileList(): Promise<string[]> {
    const gitignorePath = path.join(process.cwd(), '.gitignore')
    const ig = ignore()
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8')
      ig.add(gitignoreContent)
    }

    const fileList = await generateFileList()
    const filteredFileList = fileList.filter((file) => {
      try {
        return !ig.ignores(file)
      } catch (error) {
        return false
      }
    })

    return filteredFileList.slice(0, 100)
  }

  /**
   * Logs the initialization message based on the special file names and silent mode.
   *
   * @param {string[]} specialFileNames - A list of special file names to be analyzed.
   * @return {void} No return value.
   */
  private logInitializationMessage(specialFileNames: string[]): void {
    if (!this.options.silent) {
      if (specialFileNames.length > 0) {
        console.log(`Cloving will analyze the list of files and the contents of the following files:

${specialFileNames.join('\n')}

Cloving will send AI a request to summarize the technologies used in this project.

This will provide better context for future Cloving requests.`)
      } else {
        console.log(`
This script will analyze the list of files in the current directory using GPT to summarize the
technologies used. This will provide better context for future Cloving requests.
        `)
      }
    }
  }

  /**
   * Processes the AI response by generating a prompt, sending it to the AI,
   * and saving the response to a temporary file and cloving.json.
   *
   * @param {any} projectDetails - A JSON object describing the project.
   * @param {string} tempFilePath - The path to the temporary file.
   * @return {Promise<void>} A promise that resolves when the AI response is processed.
   */
  private async processAIResponse(projectDetails: any, tempFilePath: string): Promise<void> {
    const prompt = `Here is a JSON object describing my project:
${JSON.stringify(projectDetails, null, 2)}`

    this.chatHistory.push({ role: 'user', content: prompt })

    const aiChatResponse = await this.gpt.generateText({ prompt, messages: this.chatHistory })

    this.chatHistory.push({ role: 'assistant', content: aiChatResponse })

    let cleanAiChatResponse = extractJsonMetadata(aiChatResponse)

    const [validSyntax, errorMessage] = this.checkClovingJsonSyntax(cleanAiChatResponse)

    if (!validSyntax) {
      // retry with the errorMessage in the prompt
      this.chatHistory.push({ role: 'user', content: errorMessage })
      const retryResponse = await this.gpt.generateText({ prompt, messages: this.chatHistory })
      this.chatHistory.push({ role: 'assistant', content: retryResponse })
      cleanAiChatResponse = extractJsonMetadata(retryResponse)
    }

    await fsPromises.writeFile(tempFilePath, cleanAiChatResponse)

    // Save the AI chat response to cloving.json
    await fsPromises.writeFile('cloving.json', cleanAiChatResponse)
    console.log('Project data saved to cloving.json')
  }

  /**
   * Checks the syntax of the generated cloving.json file.
   *
   * @param {string} cleanAiChatResponse - The cleaned AI chat response.
   * @return {[boolean, string]} An array where the first element is a boolean indicating
   *                             whether the syntax was valid, and the second element is a
   *                             message explaining any errors.
   */
  private checkClovingJsonSyntax(cleanAiChatResponse: string): [boolean, string] {
    try {
      JSON.parse(cleanAiChatResponse)
    } catch (error) {
      return [false, `Error parsing cloving.json: ${(error as Error).message}`]
    }

    const clovingJson = JSON.parse(cleanAiChatResponse)

    const directoriesToCheck = [
      ...clovingJson.languages.map((language: any) => language.directory),
      ...clovingJson.frameworks.map((framework: any) => framework.directory),
      ...clovingJson.testingFrameworks.map((testingFramework: any) => testingFramework.directory),
    ]

    const missingDirectories = directoriesToCheck.filter((directory) => !fs.existsSync(directory))

    if (missingDirectories.length > 0) {
      return [false, `The following directories were not found: ${missingDirectories.join(', ')}`]
    }

    return [true, '']
  }

  /**
   * Prompts the user to review the generated data if the `silent` option is not set.
   * If the user confirms, reads the content of 'cloving.json' and logs it to the console.
   *
   * @return {Promise<void>} A promise that resolves when the review is complete.
   */
  private async promptUserForReview(): Promise<void> {
    if (!this.options.silent) {
      const reviewAnswer = await confirm({
        message: 'Do you want to review the generated data?',
        default: true,
      })
      if (reviewAnswer) {
        const clovingJsonContent = await fsPromises.readFile('cloving.json', 'utf-8')
        console.log(clovingJsonContent)
      }
    }
  }
}

export default InitManager
