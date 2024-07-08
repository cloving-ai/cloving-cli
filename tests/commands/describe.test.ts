import { execFileSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import describeFunction, { estimateTokens, extractJsonMetadata } from '../../src/commands/describe'

// Mock child_process.execFileSync
jest.mock('child_process', () => ({
  execFileSync: jest.fn(),
}))

// Mock fs methods
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}))

// Mock os.tmpdir
jest.spyOn(os, 'tmpdir').mockReturnValue('/tmp')

// Mock getModel
jest.mock('../../src/utils/model_utils', () => ({
  getModel: jest.fn().mockReturnValue('test-model'),
}))

describe('estimateTokens', () => {
  it('should estimate token count based on character count', async () => {
    const text = 'This is a test string.'
    const tokenCount = await estimateTokens(text)
    expect(tokenCount).toBe(Math.ceil(text.length / 4))
  })
})

describe('extractJsonMetadata', () => {
  it('should extract JSON metadata from a response containing a JSON block', () => {
    const response = 'Some text before\n```json\n{"key": "value"}\n```\nSome text after'
    const jsonMetadata = extractJsonMetadata(response)
    expect(jsonMetadata).toBe('{"key": "value"}')
  })

  it('should return null if JSON block is not found', () => {
    const response = 'Some text without JSON block'
    const jsonMetadata = extractJsonMetadata(response)
    expect(jsonMetadata).toBeNull()
  })
})

describe('describe', () => {
  const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>
  const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>
  const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>
  const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>
  const mockUnlinkSync = fs.unlinkSync as jest.MockedFunction<typeof fs.unlinkSync>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should describe the project and handle AI response correctly', async () => {
    mockExecFileSync.mockReturnValueOnce(Buffer.from('file1\nfile2\nfile3')) // Mock file list
      .mockReturnValueOnce(Buffer.from('{"result": "test"}')) // Mock AI response
    mockExistsSync.mockReturnValueOnce(true) // Mock package.json exists
    mockReadFileSync.mockReturnValueOnce(JSON.stringify({ name: 'test-project' })) // Mock package.json content
    mockExistsSync.mockReturnValueOnce(false) // Mock Gemfile does not exist

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation()
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    await describeFunction()

    // Check that execFileSync was called correctly
    expect(mockExecFileSync).toHaveBeenCalledTimes(2)
    expect(mockExecFileSync).toHaveBeenCalledWith('sh', ['-c', 'find . | grep -v .git | grep -v node_modules'], { maxBuffer: 10 * 1024 * 1024 })
    expect(mockExecFileSync).toHaveBeenCalledWith('aichat', ['-m', 'test-model', '-r', 'coder', expect.any(String)])

    // Check that fs methods were called correctly
    expect(mockWriteFileSync).toHaveBeenCalledWith(expect.any(String), '{"result": "test"}')
    expect(mockUnlinkSync).toHaveBeenCalledWith(expect.any(String))

    // Check console output
    expect(consoleLogSpy).toHaveBeenCalledWith('{"result": "test"}')

    // Clean up spies
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  it('should handle errors gracefully', async () => {
    mockExecFileSync.mockImplementationOnce(() => { throw new Error('Test error') })

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    await describeFunction()

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error describing the project:', 'Test error')

    consoleErrorSpy.mockRestore()
  })
})
