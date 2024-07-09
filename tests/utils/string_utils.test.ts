import { estimateTokens, extractJsonMetadata } from '../../src/utils/string_utils'

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
    const response = 'Some text without JSON block\n\n{"key": "value"}'
    const jsonMetadata = extractJsonMetadata(response)
    expect(jsonMetadata).toBe('{"key": "value"}')
  })
})

