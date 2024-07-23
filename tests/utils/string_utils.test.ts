import { extractFilesAndContent, extractMarkdown } from '../../src/utils/string_utils';

describe('stringUtils', () => {
  describe('extractFilesAndContent', () => {
    test('should extract file names and content from raw code command', () => {
      const rawCodeCommand = "**file1.txt**\n\n```plaintext\nContent of file 1\n```\n**file2.txt**\n\n```plaintext\nContent of file 2\n```";
      const [files, fileContents] = extractFilesAndContent(rawCodeCommand);
      expect(files).toEqual(["file1.txt", "file2.txt"]);
      expect(fileContents).toEqual({
        "file1.txt": "Content of file 1",
        "file2.txt": "Content of file 2"
      });
    });

    test('should return empty arrays if no matches are found', () => {
      const rawCodeCommand = "No files here.";
      const [files, fileContents] = extractFilesAndContent(rawCodeCommand);
      expect(files).toEqual([]);
      expect(fileContents).toEqual({});
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
