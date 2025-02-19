import {
  getGitDiff,
  getDefaultBranchName,
  getCurrentBranchName,
  findCommitlintConfig,
  generateCommitMessagePrompt,
  readCommitlintConfig,
} from '../../src/utils/git_utils'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}))

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}))

describe('gitUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('getDefaultBranchName should return the default branch name', async () => {
    ;(execSync as jest.Mock).mockReturnValueOnce('main\n')
    const result = await getDefaultBranchName()
    expect(result).toBe('main')
  })

  test('getCurrentBranchName should return the current branch name', () => {
    ;(execSync as jest.Mock).mockReturnValueOnce('feature-branch\n')
    const result = getCurrentBranchName()
    expect(result).toBe('feature-branch')
  })

  describe('commitlint integration', () => {
    test('findCommitlintConfig should return null when no config file exists', () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      const result = findCommitlintConfig()
      expect(result).toBeNull()
    })

    test('findCommitlintConfig should return the path when a config file exists', () => {
      ;(fs.existsSync as jest.Mock).mockImplementation(
        (path: string) => path === '.commitlintrc.json',
      )
      const result = findCommitlintConfig()
      expect(result).toBe('.commitlintrc.json')
    })

    test('readCommitlintConfig should parse JSON config files', () => {
      const mockConfig = {
        extends: ['@commitlint/config-conventional'],
        rules: {
          'type-enum': [2, 'always', ['feat', 'fix']],
        },
      }
      ;(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig))
      const result = readCommitlintConfig('.commitlintrc.json')
      expect(result).toEqual(mockConfig)
    })

    test('readCommitlintConfig should handle YAML config files', () => {
      const mockYamlConfig = `
extends: ['@commitlint/config-conventional']
rules:
  type-enum: [2, 'always', ['feat', 'fix']]
`
      ;(fs.readFileSync as jest.Mock).mockReturnValue(mockYamlConfig)
      const result = readCommitlintConfig('.commitlintrc.yml')
      expect(result).toEqual({ config: mockYamlConfig })
    })

    test('readCommitlintConfig should return null for JS/TS config files', () => {
      const result = readCommitlintConfig('commitlint.config.js')
      expect(result).toBeNull()
    })

    test('generateCommitMessagePrompt should include config when commitlint config exists', () => {
      const mockConfig = {
        extends: ['@commitlint/config-conventional'],
        rules: {
          'type-enum': [2, 'always', ['feat', 'fix']],
        },
      }
      ;(fs.existsSync as jest.Mock).mockImplementation(
        (path: string) => path === '.commitlintrc.json',
      )
      ;(fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig))

      const diff = 'sample diff'
      const result = generateCommitMessagePrompt(diff)

      expect(result).toContain('Found commitlint configuration at .commitlintrc.json')
      expect(result).toContain('"extends":')
      expect(result).toContain('"rules":')
    })

    test('generateCommitMessagePrompt should use regular format when no commitlint config exists', () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      const diff = 'sample diff'
      const result = generateCommitMessagePrompt(diff)
      expect(result).not.toContain('conventional commit message')
      expect(result).toContain('concise and meaningful commit message')
    })
  })
})
