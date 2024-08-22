import {
  extractCurrentNewBlocks,
  extractMarkdown,
  searchReplaceString,
  checkBlocksApplicability,
} from '../../src/utils/string_utils'

describe('stringUtils', () => {
  describe('extractCurrentNewBlocks', () => {
    test('should extract current and new blocks from input', () => {
      const input = `
<<<<<<< CURRENT src/file1.ts
const oldVar = 1
=======
const newVar = 2
>>>>>>> NEW

Some text in between

<<<<<<< CURRENT src/file2.ts
function oldFunction() {
  return 'old'
}
=======
function newFunction() {
  return 'new'
}
>>>>>>> NEW
      `

      const result = extractCurrentNewBlocks(input)

      expect(result).toEqual([
        {
          filePath: 'src/file1.ts',
          currentContent: 'const oldVar = 1',
          newContent: 'const newVar = 2',
        },
        {
          filePath: 'src/file2.ts',
          currentContent: "function oldFunction() {\n  return 'old'\n}",
          newContent: "function newFunction() {\n  return 'new'\n}",
        },
      ])
    })

    test('should handle empty current content', () => {
      const input = `
<<<<<<< CURRENT src/newfile.ts
=======
const newContent = 'This is new'
>>>>>>> NEW
      `

      const result = extractCurrentNewBlocks(input)

      expect(result).toEqual([
        {
          filePath: 'src/newfile.ts',
          currentContent: '',
          newContent: "const newContent = 'This is new'",
        },
      ])
    })

    test('should return an empty array if no blocks are found', () => {
      const input = 'No blocks here'

      const result = extractCurrentNewBlocks(input)

      expect(result).toEqual([])
    })

    test('should not change content if current content is not found', () => {
      const currentContent = `
        function example() {
          console.log('Old content')
        }
        `
      const block = {
        filePath: '/tmp/test',
        currentContent: "console.log('Non-existent content')",
        newContent: "console.log('New content')",
      }
      const updatedContent = searchReplaceString(currentContent, block)
      expect(updatedContent).toBe(currentContent)
    })

    test('should replace entire content if current content is empty', () => {
      const currentContent = ''
      const block = {
        filePath: '/tmp/test',
        currentContent: '',
        newContent: "console.log('New content')",
      }
      const updatedContent = searchReplaceString(currentContent, block)
      expect(updatedContent).toBe("console.log('New content')")
    })

    test('should preserve indentation of new content', () => {
      const currentContent = `function example() {
      console.log('Old content')
    }`
      const block = {
        filePath: '/tmp/test',
        currentContent: "console.log('Old content')",
        newContent: "console.log('New content with indentation')",
      }
      const updatedContent = searchReplaceString(currentContent, block)
      expect(updatedContent).toBe(`function example() {
      console.log('New content with indentation')
    }`)
    })
  })

  describe('extractMarkdown', () => {
    test('should extract markdown content from response', () => {
      const response = 'Here is some text\n```markdown\n# Title\nContent here.\n```\nMore text'
      const result = extractMarkdown(response)
      expect(result).toBe('# Title\nContent here.')
    })

    test('should return the entire response if no markdown block is found', () => {
      const response = 'No markdown block here.'
      const result = extractMarkdown(response)
      expect(result).toBe('No markdown block here.')
    })
  })

  describe('searchReplaceString', () => {
    test('should replace current content with new content', () => {
      const currentContent = `function example() {
  console.log('Old content')
}`
      const block = {
        filePath: '/tmp/test',
        currentContent: "console.log('Old content')",
        newContent: "console.log('New content')",
      }
      const updatedContent = searchReplaceString(currentContent, block)
      expect(updatedContent).toBe(`function example() {
  console.log('New content')
}`)
    })

    test('should replace current content with new content with matching indentation', () => {
      const currentContent = `function example() {
  console.log('Old content')
}`
      const block = {
        filePath: '/tmp/test',
        currentContent: "  console.log('Old content')",
        newContent: "  console.log('New content')",
      }
      const updatedContent = searchReplaceString(currentContent, block)
      expect(updatedContent).toBe(`function example() {
  console.log('New content')
}`)
    })

    test('should do the correct indentation when there is indentation', () => {
      const currentContent = `  function example() {
    console.log('Old content')
  }`
      const block = {
        filePath: '/tmp/test',
        currentContent: "    console.log('Old content')",
        newContent: "    console.log('New content')",
      }
      const updatedContent = searchReplaceString(currentContent, block)
      expect(updatedContent).toBe(`  function example() {
    console.log('New content')
  }`)
    })

    test("should do the correct indentation when there is indentation and the diff doesn't", () => {
      const currentContent = `  function example() {
    console.log('Old content')
  }`
      const block = {
        filePath: '/tmp/test',
        currentContent: "console.log('Old content')",
        newContent: "console.log('New content')",
      }
      const updatedContent = searchReplaceString(currentContent, block)
      expect(updatedContent).toBe(`  function example() {
    console.log('New content')
  }`)
    })

    test('should do the correct indentation when replacing large chunks', () => {
      const currentContent = `  function example() {
    console.log('Old content')
  }`
      const block = {
        filePath: '/tmp/test',
        currentContent: `  function example() {
    console.log('Old content')
  }`,
        newContent: `  function example() {
    console.log('New content')
  }`,
      }
      const updatedContent = searchReplaceString(currentContent, block)
      expect(updatedContent).toBe(`  function example() {
    console.log('New content')
  }`)
    })

    test('should do the correct indentation when adding new lines of code', () => {
      const currentContent = `  function example() {
    console.log('Old content')
  }`
      const block = {
        filePath: '/tmp/test',
        currentContent: `  function example() {
    console.log('Old content')
  }`,
        newContent: `  # This is a comment
  function example() {
    # here is a new comment
    console.log('Old content')
  }`,
      }
      const updatedContent = searchReplaceString(currentContent, block)
      expect(updatedContent).toBe(`  # This is a comment
  function example() {
    # here is a new comment
    console.log('Old content')
  }`)
    })
  })

  describe('extractCurrentNewBlocks and searchReplaceString integration', () => {
    test('should extract blocks and replace content correctly', () => {
      const diffString = `Here is some text\n\`\`\`typescript
<<<<<<< CURRENT src/managers/ShellManager.ts
constructor(private options: ClovingGPTOptions) {
  options.silent = getConfig(options).globalSilent || false
  this.gpt = new ClovingGPT(options)
}
=======
constructor(private options: ClovingGPTOptions) {
  options.silent = getConfig(options).globalSilent || false
  options.exec = options.exec || false
  this.gpt = new ClovingGPT(options)
}
>>>>>>> NEW
\`\`\`\n\nThat is the current content of the file.`

      const existingContent = `class ShellManager {
  private gpt: ClovingGPT
  private chatHistory: ChatMessage[] = []

  constructor(private options: ClovingGPTOptions) {
    options.silent = getConfig(options).globalSilent || false
    this.gpt = new ClovingGPT(options)
  }
}`

      // Extract blocks
      const blocks = extractCurrentNewBlocks(diffString)

      // Check if blocks are extracted correctly
      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        filePath: 'src/managers/ShellManager.ts',
        currentContent: `constructor(private options: ClovingGPTOptions) {
  options.silent = getConfig(options).globalSilent || false
  this.gpt = new ClovingGPT(options)
}`,
        newContent: `constructor(private options: ClovingGPTOptions) {
  options.silent = getConfig(options).globalSilent || false
  options.exec = options.exec || false
  this.gpt = new ClovingGPT(options)
}`,
      })

      // Apply the change using searchReplaceString
      const updatedContent = searchReplaceString(existingContent, blocks[0])

      // Check if the content is updated correctly
      const expectedContent = `class ShellManager {
  private gpt: ClovingGPT
  private chatHistory: ChatMessage[] = []

  constructor(private options: ClovingGPTOptions) {
    options.silent = getConfig(options).globalSilent || false
    options.exec = options.exec || false
    this.gpt = new ClovingGPT(options)
  }
}`

      expect(updatedContent).toBe(expectedContent)
    })
  })
})
