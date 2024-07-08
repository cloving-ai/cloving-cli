import { getModel } from '../../src/utils/modelUtils'

describe('modelUtils', () => {
  test('getModel should work correctly', () => {
    const result = getModel()
    expect(result).toBe('claude:claude-3-5-sonnet-20240620')
  })
})
