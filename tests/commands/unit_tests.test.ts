import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFileSync } from 'child_process'
import ClovingGPT from '../../src/cloving_gpt'
import { readClovingConfig } from '../../src/utils/command_utils'
import unitTests from '../../src/commands/unit_tests'
import { getGitDiff } from '../../src/utils/git_utils'

jest.mock('fs')
jest.mock('child_process')
jest.mock('../../src/cloving_gpt')
jest.mock('../../src/utils/command_utils')
jest.mock('../../src/utils/git_utils')

describe('unitTests', () => {
  const mockConfig = {
    testingFrameworks: [{ directory: 'spec' }],
    languages: [
      { directory: 'src', extension: '.ts' },
      { directory: 'lib', extension: '.rb' }
    ]
  }

  beforeEach(() => {
    jest.clearAllMocks()
      ; (readClovingConfig as jest.Mock).mockReturnValue(mockConfig)
      ; (execFileSync as jest.Mock).mockReturnValue(Buffer.from('file1.ts\nfile2.rb'))
      ; (fs.existsSync as jest.Mock).mockReturnValue(true)
      ; (fs.statSync as jest.Mock).mockReturnValue({ isFile: () => true })
      ; (fs.readFileSync as jest.Mock).mockReturnValue('file contents')

    jest.spyOn(console, 'log').mockImplementation(() => { })
    jest.spyOn(console, 'error').mockImplementation(() => { })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should generate unit tests for specified files', async () => {
    const mockGenerateText = jest.fn().mockResolvedValue('Generated unit tests')
      ; (ClovingGPT as jest.Mock).mockImplementation(() => ({
        generateText: mockGenerateText
      }))

    const options = { files: ['file1.ts', 'file2.rb'] }
    await unitTests(options)

    expect(mockGenerateText).toHaveBeenCalledTimes(2)
    expect(mockGenerateText.mock.calls[0][0].prompt).toContain('file1.ts\nfile2.rb')
    expect(console.log).toHaveBeenCalledWith('Generated unit tests')
  })

  it('should generate unit tests for git diff when no files are specified', async () => {
    const mockGitDiff = 'mock git diff'
      ; (getGitDiff as jest.Mock).mockResolvedValue(mockGitDiff)
    const mockGenerateText = jest.fn().mockResolvedValue('Generated unit tests')
      ; (ClovingGPT as jest.Mock).mockImplementation(() => ({
        generateText: mockGenerateText
      }))

    const options = {}
    await unitTests(options)

    expect(getGitDiff).toHaveBeenCalled()
    expect(mockGenerateText).toHaveBeenCalledTimes(2)
    expect(mockGenerateText.mock.calls[0][0].prompt).toContain(mockGitDiff)
    expect(console.log).toHaveBeenCalledWith('Generated unit tests')
  })

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Test error')
      ; (ClovingGPT as jest.Mock).mockImplementation(() => ({
        generateText: jest.fn().mockRejectedValue(mockError)
      }))

    const options = { files: ['file1.ts'] }
    await unitTests(options)

    expect(console.error).toHaveBeenCalledWith('Error processing unit tests:', 'Test error')
  })

  it('should use the correct testing directory from config', async () => {
    const customConfig = {
      ...mockConfig,
      testingFrameworks: [{ directory: 'custom_tests' }]
    }
      ; (readClovingConfig as jest.Mock).mockReturnValue(customConfig)

    const mockGenerateText = jest.fn().mockResolvedValue('Generated unit tests')
      ; (ClovingGPT as jest.Mock).mockImplementation(() => ({
        generateText: mockGenerateText
      }))

    const options = { files: ['file1.ts'] }
    await unitTests(options)

    expect(execFileSync).toHaveBeenCalledWith('find', ['custom_tests', '-type', 'f'])
  })
})