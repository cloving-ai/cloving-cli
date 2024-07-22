
import { getModel } from '../../src/utils/model_utils'

describe('modelUtils', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  test('getModel should return default model when CLOVING_MODEL is not set', () => {
    delete process.env.CLOVING_MODEL
    const result = getModel()
    expect(result).toBe('claude:claude-3-5-sonnet-20240620')
  })

  test('getModel should return CLOVING_MODEL when it is set', () => {
    process.env.CLOVING_MODEL = 'openai:gpt-4'
    const result = getModel()
    expect(result).toBe('openai:gpt-4')
  })
})
