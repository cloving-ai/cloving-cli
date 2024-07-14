import nock from 'nock'
import ClovingGPT from '../../src/cloving_gpt'
import readline from 'readline'

jest.mock('readline')

describe('ClovingGPT', () => {
  const OLD_ENV = process.env
  const mockReadline = readline.createInterface as jest.Mock

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV }
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('should throw an error if CLOVING_MODEL is not set', () => {
    process.env.CLOVING_MODEL = ''
    process.env.CLOVING_API_KEY = 'test_api_key'

    expect(() => new ClovingGPT()).toThrow("No cloving configuration found. Please run `cloving config`")
  })

  it('should throw an error if CLOVING_API_KEY is not set', () => {
    process.env.CLOVING_MODEL = 'claude:claude-3-5-sonnet-20240620'
    process.env.CLOVING_API_KEY = ''

    expect(() => new ClovingGPT()).toThrow("No cloving configuration found. Please run `cloving config`")
  })

  it('should return text from openai API', async () => {
    process.env.CLOVING_MODEL = 'openai:text-davinci-003'
    process.env.CLOVING_API_KEY = 'test_api_key'

    nock('https://api.openai.com')
      .post('/v1/engines/text-davinci-003/completions')
      .reply(200, {
        choices: [{ text: 'Hello, world!' }]
      })

    const gpt = new ClovingGPT()

    // Mock readline to simulate user inputs
    mockReadline.mockImplementation(() => ({
      question: jest.fn((_, cb) => cb('y')),
      close: jest.fn()
    }))

    const result = await gpt.generateText({ prompt: 'Say hello' })
    expect(result).toBe('Hello, world!')
  })

  it('should return text from claude API', async () => {
    process.env.CLOVING_MODEL = 'claude:claude-3-5-sonnet-20240620'
    process.env.CLOVING_API_KEY = 'test_api_key'

    nock('https://api.anthropic.com')
      .post('/v1/claude/claude-3-5-sonnet-20240620')
      .reply(200, {
        completion: 'Hello, Claude!'
      })

    const gpt = new ClovingGPT()

    // Mock readline to simulate user inputs
    mockReadline.mockImplementation(() => ({
      question: jest.fn((_, cb) => cb('y')),
      close: jest.fn()
    }))

    const result = await gpt.generateText({ prompt: 'Say hello' })
    expect(result).toBe('Hello, Claude!')
  })

  it('should return text from gpt4all API', async () => {
    process.env.CLOVING_MODEL = 'gpt4all:gpt4all-v1'
    process.env.CLOVING_API_KEY = 'test_api_key'

    nock('https://api.gpt4all.io')
      .post('/v1/models/gpt4all-v1/completions')
      .reply(200, {
        text: 'Hello, GPT-4-All!'
      })

    const gpt = new ClovingGPT()

    // Mock readline to simulate user inputs
    mockReadline.mockImplementation(() => ({
      question: jest.fn((_, cb) => cb('y')),
      close: jest.fn()
    }))

    const result = await gpt.generateText({ prompt: 'Say hello' })
    expect(result).toBe('Hello, GPT-4-All!')
  })

  it('should cancel the operation if user chooses not to continue', async () => {
    process.env.CLOVING_MODEL = 'openai:text-davinci-003'
    process.env.CLOVING_API_KEY = 'test_api_key'

    const gpt = new ClovingGPT()

    // Mock readline to simulate user inputs
    mockReadline.mockImplementation(() => ({
      question: jest.fn((_, cb) => {
        if (cb.mock.calls.length === 0) cb('y') // First prompt: show the prompt
        else cb('n') // Second prompt: do not continue
      }),
      close: jest.fn()
    }))

    const result = await gpt.generateText({ prompt: 'Say hello' })
    expect(result).toBe('')
  })
})
