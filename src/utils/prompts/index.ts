import fs from 'fs'
import path from 'path'

const CODEGEN_INSTRUCTIONS = fs.readFileSync(
  path.resolve(__dirname, 'CODEGEN_INSTRUCTIONS.md'),
  'utf-8',
)
const INIT_INSTRUCTIONS = fs.readFileSync(path.resolve(__dirname, 'INIT_INSTRUCTIONS.md'), 'utf-8')
const SPECIAL_FILES_PATH = fs.readFileSync(path.resolve(__dirname, 'SPECIAL_FILES.md'), 'utf-8')
const SPECIAL_FILES = SPECIAL_FILES_PATH.split('\n')
  .filter((line) => line.startsWith('- '))
  .map((line) => line.slice(2).trim())

export { CODEGEN_INSTRUCTIONS, INIT_INSTRUCTIONS, SPECIAL_FILES }
