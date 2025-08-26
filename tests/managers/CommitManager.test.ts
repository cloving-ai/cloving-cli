// Test the cleanCommitMessage logic independently
function cleanCommitMessage(message: string): string {
  // First check if there's a conventional commit message inside a code block
  const conventionalCommitRegex = /```\n([a-z]+(?:\([^)]+\))?: [\s\S]*?)```/m
  const conventionalMatch = message.match(conventionalCommitRegex)

  if (conventionalMatch) {
    return conventionalMatch[1].trim()
  }

  // Remove markdown code block formatting if present, including any text before and after
  const codeBlockRegex = /.*?```.*\n([\s\S]*?)\n```.*/m
  const match = message.match(codeBlockRegex)
  return match ? match[1].trim() : message.trim()
}

describe('CommitManager cleanCommitMessage', () => {
  describe('cleanCommitMessage', () => {
    it('should extract conventional commit message from code block', () => {
      const input = `Here's a conventional commit message based on the provided diff:

\`\`\`
feat(workshops): add facilitator features and improve user management
\`\`\`

This commit adds new functionality for workshop facilitators.`

      const result = cleanCommitMessage(input)
      expect(result).toBe('feat(workshops): add facilitator features and improve user management')
    })

    it('should handle commit messages with # symbols', () => {
      const input = `\`\`\`
fix(auth): resolve issue #123 with authentication flow
\`\`\``

      const result = cleanCommitMessage(input)
      expect(result).toBe('fix(auth): resolve issue #123 with authentication flow')
    })

    it('should handle commit messages with multiple # symbols', () => {
      const input = `\`\`\`
feat(ui): add support for #hashtags and issue #456 references
\`\`\``

      const result = cleanCommitMessage(input)
      expect(result).toBe('feat(ui): add support for #hashtags and issue #456 references')
    })

    it('should handle commit messages with # at the beginning', () => {
      const input = `\`\`\`
docs: update #README with installation instructions
\`\`\``

      const result = cleanCommitMessage(input)
      expect(result).toBe('docs: update #README with installation instructions')
    })

    it('should handle regular markdown code blocks without conventional commit pattern', () => {
      const input = `Here's the solution:

\`\`\`
Some regular commit message here
\`\`\``

      const result = cleanCommitMessage(input)
      expect(result).toBe('Some regular commit message here')
    })

    it('should handle plain text without code blocks', () => {
      const input = 'feat: add new feature with #123 issue reference'

      const result = cleanCommitMessage(input)
      expect(result).toBe('feat: add new feature with #123 issue reference')
    })

    it('should handle multiline commit messages with # symbols', () => {
      const input = `\`\`\`
feat(api): add new endpoint for user management

- Implement user creation with #validation
- Add error handling for issue #789
- Update documentation
\`\`\``

      const result = cleanCommitMessage(input)
      expect(result).toBe(`feat(api): add new endpoint for user management

- Implement user creation with #validation
- Add error handling for issue #789
- Update documentation`)
    })
  })
})
