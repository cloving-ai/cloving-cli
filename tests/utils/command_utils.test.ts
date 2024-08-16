import { generateCodegenPrompt, CODEGEN_INSTRUCTIONS } from '../../src/utils/command_utils'

jest.mock('../../src/utils/config_utils', () => ({
  getClovingConfig: jest.fn().mockReturnValue({}),
}))

describe('command_utils', () => {
  describe('CODEGEN_INSTRUCTIONS', () => {
    it('should contain the correct instructions', () => {
      expect(CODEGEN_INSTRUCTIONS).toContain('AI Code Generation Instructions')
      expect(CODEGEN_INSTRUCTIONS).toContain('General Guidelines')
      expect(CODEGEN_INSTRUCTIONS).toContain('Request Handling')
      expect(CODEGEN_INSTRUCTIONS).toContain('*CURRENT/NEW* Block Format')
    })
  })

  describe('generateCodegenPrompt', () => {
    it('should include CODEGEN_INSTRUCTIONS in the generated prompt', () => {
      const contextFilesContent = { 'test.ts': 'console.log("test");' }
      const result = generateCodegenPrompt(contextFilesContent)
      expect(result).toContain(CODEGEN_INSTRUCTIONS)
    })

    it('should include context files content in the generated prompt', () => {
      const contextFilesContent = { 'test.ts': 'console.log("test");' }
      const result = generateCodegenPrompt(contextFilesContent)
      expect(result).toContain('test.ts')
      expect(result).toContain('console.log("test");')
    })
  })
})
