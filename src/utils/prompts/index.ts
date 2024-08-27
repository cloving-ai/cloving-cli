import fs from 'fs'
import path from 'path'

const CODEGEN_COULDNT_APPLY = fs.readFileSync(
  path.resolve(__dirname, 'CODEGEN_COULDNT_APPLY.md'),
  'utf-8',
)
const CODEGEN_INSTRUCTIONS = fs.readFileSync(
  path.resolve(__dirname, 'CODEGEN_INSTRUCTIONS.md'),
  'utf-8',
)
const CODEGEN_EXAMPLES = fs.readFileSync(path.resolve(__dirname, 'CODEGEN_EXAMPLES.md'), 'utf-8')
const SHELL_INSTRUCTIONS = fs.readFileSync(
  path.resolve(__dirname, 'SHELL_INSTRUCTIONS.md'),
  'utf-8',
)
const REVIEW_INSTRUCTIONS = fs.readFileSync(
  path.resolve(__dirname, 'REVIEW_INSTRUCTIONS.md'),
  'utf-8',
)
const DOCS_INSTRUCTIONS = fs.readFileSync(path.resolve(__dirname, 'DOCS_INSTRUCTIONS.md'), 'utf-8')
const INIT_INSTRUCTIONS = fs.readFileSync(path.resolve(__dirname, 'INIT_INSTRUCTIONS.md'), 'utf-8')
const SPECIAL_FILES_PATH = fs.readFileSync(path.resolve(__dirname, 'SPECIAL_FILES.md'), 'utf-8')
const SPECIAL_FILES = SPECIAL_FILES_PATH.split('\n')
  .filter((line) => line.startsWith('- '))
  .map((line) => line.slice(2).trim())

export {
  SHELL_INSTRUCTIONS,
  CODEGEN_INSTRUCTIONS,
  CODEGEN_COULDNT_APPLY,
  DOCS_INSTRUCTIONS,
  INIT_INSTRUCTIONS,
  SPECIAL_FILES,
  CODEGEN_EXAMPLES,
  REVIEW_INSTRUCTIONS,
}
