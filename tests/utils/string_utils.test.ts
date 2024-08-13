import { extractCurrentNewBlocks, extractMarkdown } from '../../src/utils/string_utils';

describe('stringUtils', () => {
  describe('extractCurrentNewBlocks', () => {
    test('should extract current and new blocks from input', () => {
      const input = `
<<<<<<< CURRENT src/file1.ts
const oldVar = 1;
=======
const newVar = 2;
>>>>>>> NEW

Some text in between

<<<<<<< CURRENT src/file2.ts
function oldFunction() {
  return 'old';
}
=======
function newFunction() {
  return 'new';
}
>>>>>>> NEW
      `;

      const result = extractCurrentNewBlocks(input);

      expect(result).toEqual([
        {
          filePath: 'src/file1.ts',
          currentContent: 'const oldVar = 1;',
          newContent: 'const newVar = 2;'
        },
        {
          filePath: 'src/file2.ts',
          currentContent: 'function oldFunction() {\n  return \'old\';\n}',
          newContent: 'function newFunction() {\n  return \'new\';\n}'
        }
      ]);
    });

    test('should handle empty current content', () => {
      const input = `
<<<<<<< CURRENT src/newfile.ts
=======
const newContent = 'This is new';
>>>>>>> NEW
      `;

      const result = extractCurrentNewBlocks(input);

      expect(result).toEqual([
        {
          filePath: 'src/newfile.ts',
          currentContent: '',
          newContent: 'const newContent = \'This is new\';'
        }
      ]);
    });

    test('should return an empty array if no blocks are found', () => {
      const input = 'No blocks here';

      const result = extractCurrentNewBlocks(input);

      expect(result).toEqual([]);
    });
  });

  describe('extractMarkdown', () => {
    test('should extract markdown content from response', () => {
      const response = "Here is some text\n```markdown\n# Title\nContent here.\n```\nMore text";
      const result = extractMarkdown(response);
      expect(result).toBe("# Title\nContent here.");
    });

    test('should return the entire response if no markdown block is found', () => {
      const response = "No markdown block here.";
      const result = extractMarkdown(response);
      expect(result).toBe("No markdown block here.");
    });
  });
});
