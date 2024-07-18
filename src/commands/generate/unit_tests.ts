
import { promises as fs } from 'fs'
import { execFileSync } from 'child_process'
import highlight from 'cli-highlight'
import inquirer from 'inquirer'
import path from 'path'

import { getGitDiff } from '../../utils/git_utils'
import { getTestingDirectory, getAllFiles } from '../../utils/config_utils'
import { extractFilesAndContent } from '../../utils/string_utils'
import ClovingGPT from '../../cloving_gpt'
import type { ClovingGPTOptions } from '../../utils/types'

const extractChangedFiles = (gitDiff: string): string[] => {
  const fileRegex = /diff --git a\/(.+?) b\/(.+?)\n/g
  const files = new Set<string>()
  let match

  while ((match = fileRegex.exec(gitDiff)) !== null) {
    files.add(match[1])
  }

  return Array.from(files)
}

const generatePrompt = (files: string[], srcFiles: string, testFiles: string, gitDiff?: string) => {
  const filesList = files.length > 0 ? files.join('\n') : 'No files provided'

  return `### List of Code Files

${filesList}

### List of All Source Files

${srcFiles}

### List of all test files

${testFiles}

### Git Diff Content

${gitDiff}

## Example Output

Give me this output format for your answer:

\`\`\`plaintext
## files

app/models/foo.rb
app/views/baz/bar.html.erb

## relevant test files

test/models/foo_test.rb
test/controllers/baz_controller_test.rb
\`\`\`

### Request

Please enumerate all the files in the provided list${gitDiff ? ' and git diff' : ''} as well as the file names of anything that these files interact with.

Also, list any test files that might be relevant to these files.`
}

const handleUserAction = async (analysis: string): Promise<void> => {
  const [files, fileContents] = extractFilesAndContent(analysis)

  const { action } = await inquirer.prompt<{ action: string }>([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Save a Unit Test File', value: 'save' },
        { name: 'Save All Unit Test Files', value: 'saveAll' },
        { name: 'Copy Unit Test to Clipboard', value: 'copyTest' },
        { name: 'Copy Entire Response to Clipboard', value: 'copyAll' },
        { name: 'Done', value: 'done' },
      ],
    },
  ])

  switch (action) {
    case 'save':
      let saveAnother = true
      while (saveAnother) {
        const { fileToSave } = await inquirer.prompt<{ fileToSave: string }>([
          {
            type: 'list',
            name: 'fileToSave',
            message: 'Which unit test file do you want to save?',
            choices: files.map(file => ({ name: file, value: file })),
          },
        ])

        if (fileContents[fileToSave]) {
          const filePath = path.resolve(fileToSave)

          fs.mkdir(path.dirname(filePath), { recursive: true })
            .then(() => fs.writeFile(filePath, fileContents[fileToSave]))
            .then(() => console.log(`${fileToSave} has been saved.`))
            .catch((error) => console.error(`Error saving ${fileToSave}:`, error))
        } else {
          console.log('File content not found.')
        }

        const { saveMore } = await inquirer.prompt<{ saveMore: boolean }>([
          {
            type: 'confirm',
            name: 'saveMore',
            message: 'Do you want to save another file?',
            default: false,
          },
        ])

        saveAnother = saveMore
      }
      break
    case 'saveAll':
      for (const file of files) {
        if (fileContents[file]) {
          const filePath = path.resolve(file)

          fs.mkdir(path.dirname(filePath), { recursive: true })
            .then(() => fs.writeFile(filePath, fileContents[file]))
            .then(() => console.log(`${file} has been saved.`))
            .catch((error) => console.error(`Error saving ${file}:`, error))
        } else {
          console.log(`File content not found for ${file}.`)
        }
      }
      console.log('All unit test files have been saved.')
      break
    case 'copyTest':
      const { fileToCopy } = await inquirer.prompt<{ fileToCopy: string }>([
        {
          type: 'list',
          name: 'fileToCopy',
          message: 'Which unit test file do you want to copy to the clipboard?',
          choices: files.map(file => ({ name: file, value: file })),
        },
      ])

      if (fileContents[fileToCopy]) {
        process.nextTick(() => {
          require('copy-paste').copy(fileContents[fileToCopy], () => {
            console.log(`${fileToCopy} copied to clipboard`)
          })
        })
      } else {
        console.log('File content not found.')
      }
      break
    case 'copyAll':
      process.nextTick(() => {
        require('copy-paste').copy(analysis, () => {
          console.log('Entire response copied to clipboard')
        })
      })
      break
    case 'done':
      break
  }
}

const unitTests = async (options: ClovingGPTOptions) => {
  const { files } = options
  const gpt = new ClovingGPT(options)

  const allSrcFiles = await getAllFiles(options, true)
  const testingDirectory = getTestingDirectory()

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

  // Read each line of the context files
  contextFiles.split('\n').forEach((line) => {
    if (line.trim()) {
      lines.push(line.trim())
    }
  })

  for (const codeFile of lines) {
    if (await fs.stat(codeFile).then(stat => stat.isFile()).catch(() => false)) {
      const fileContents = await fs.readFile(codeFile, 'utf-8')
      context.push(`### Contents of ${codeFile}\n\n${fileContents}\n\n### End of ${codeFile}`)
    }
  }

  // Generate the message for unit test creation
  let analysis = ''

  if ((files || []).length > 0) {
    const message = `please create unit tests for these files:

## Begin list of files
${(files || []).join('\n')}
## End list of files

## Context
${context.join('\n\n')}`

    // Get the model and analysis using ClovingGPT
    analysis = await gpt.generateText({ prompt: message })
  } else {
    const message = `please create unit tests for these changes:

## Begin diff
${await getGitDiff()}
## End diff

## Context

${context.join('\n\n')}`

    // Get the model and analysis using ClovingGPT
    analysis = await gpt.generateText({ prompt: message })
  }

  console.log(highlight(analysis))

  // Add the new user action handling
  await handleUserAction(analysis)
}

export default unitTests
