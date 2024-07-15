import { promises as fs } from 'fs'
import { execFileSync } from 'child_process'
import { getGitDiff } from '../utils/git_utils'
import ClovingGPT from '../cloving_gpt'
import { readClovingConfig } from '../utils/config_utils'
import type { ClovingGPTOptions, ClovingfileConfig } from '../utils/types'

const extractChangedFiles = (gitDiff: string): string[] => {
  const fileRegex = /diff --git a\/(.+?) b\/(.+?)\n/g
  const files = new Set<string>()
  let match

  while ((match = fileRegex.exec(gitDiff)) !== null) {
    files.add(match[1])
  }

  return Array.from(files)
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

const generatePrompt = (files: string[], srcFiles: string, testFiles: string, gitDiff?: string) => {
  const filesList = files.length > 0 ? files.join('\n') : 'No files provided'
  const diffSection = gitDiff ? `Here is my git diff:\n\n==== begin git diff ====\n${gitDiff}\n==== end git diff ====\n` : ''

  return `Here is a list of code files I want to generate unit tests for:

==== begin list of files ====
${filesList}
==== end list of files ====

Here is a list of all my source files:

==== begin list of source files ====
${srcFiles}
==== end list of source files ====

Here is a list of all my test files:

==== begin list of test files ====
${testFiles}
==== end list of test files ====

${diffSection}

Please enumerate all the files in the provided list${gitDiff ? ' and git diff' : ''} as well as the file names of anything that these files interact with.

Also, list any test files that might be relevant to these files.

Give me this output format for your answer:

## files

app/models/foo.rb
app/views/baz/bar.html.erb

## relevant test files

test/models/foo_test.rb
test/controllers/baz_controller_test.rb`
}

const unitTests = async (options: ClovingGPTOptions) => {
  const { files } = options
  const gpt = new ClovingGPT(options)

  // Read the cloving.json file
  const config = readClovingConfig()
  const testingDirectory = config.testingFrameworks?.find((framework: any) => framework.directory)?.directory

  if (!testingDirectory) {
    await setupTestingPrompt(gpt, config)
  }

  let allSrcFiles: string[] = []

  // Collect srcFiles for each language with specified directory and extension
  for (const language of config.languages) {
    if (language.directory && language.extension) {
      const srcFiles = execFileSync('find', [language.directory, '-type', 'f', '-name', `*${language.extension}`]).toString().trim().split('\n')
      allSrcFiles = allSrcFiles.concat(srcFiles)
    }
  }

  // Ensure allSrcFiles is unique
  allSrcFiles = Array.from(new Set(allSrcFiles))

  if (allSrcFiles.length === 0 || !testingDirectory) {
    console.error('Could not find any source files to generate unit tests. Please run: cloving init. Then try again.')
    process.exit(1)
  }

  const testFiles = execFileSync('find', [testingDirectory, '-type', 'f']).toString().trim()
  let contextFiles: string

  if (files) {
    const prompt = generatePrompt(files, allSrcFiles.join('\n'), testFiles)
    contextFiles = await gpt.generateText({ prompt })
  } else {
    const gitDiff = await getGitDiff()
    const changedFiles = extractChangedFiles(gitDiff)
    const prompt = generatePrompt(changedFiles, allSrcFiles.join('\n'), testFiles, gitDiff)
    contextFiles = await gpt.generateText({ prompt })
  }

  // Initialize variables
  const lines: string[] = []
  const context: string[] = []

  // Read input from temporary file
  contextFiles.split('\n').forEach((line) => {
    if (line.trim()) {
      lines.push(line.trim())
    }
  })

  for (const codeFile of lines) {
    if (await fs?.stat(codeFile).then(stat => stat.isFile()).catch(() => false)) {
      const fileContents = await fs.readFile(codeFile, 'utf-8')
      context.push(`### **Contents of ${codeFile}**\n\n${fileContents}\n\n### **End of ${codeFile}**`)
    }
  }

  // Generate the message for unit test creation
  let analysis = ''

  if ((files || []).length > 0) {
    const message = `please create unit tests for these files:

## begin list of files
${(files || []).join('\n')}
## end list of files

## context
${context.join('\n\n')}`

    // Get the model and analysis using ClovingGPT
    analysis = await gpt.generateText({ prompt: message })
  } else {
    const message = `please create unit tests for these changes:

## begin diff
${await getGitDiff()}
## end diff

## context

${context.join('\n\n')}`

    // Get the model and analysis using ClovingGPT
    analysis = await gpt.generateText({ prompt: message })
  }

  console.log(analysis)
}

export default unitTests