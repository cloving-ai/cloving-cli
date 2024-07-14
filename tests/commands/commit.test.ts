import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import ClovingGPT from '../../src/cloving_gpt';
import { generateCommitMessagePrompt } from '../../src/utils/git_utils';
import { extractMarkdown } from '../../src/utils/string_utils';
import { getConfig } from '../../src/utils/command_utils';
import generateAndCommitMessage from '../../src/commands/commit';

jest.mock('fs');
jest.mock('child_process');
jest.mock('../../src/cloving_gpt');
jest.mock('../../src/utils/git_utils');
jest.mock('../../src/utils/string_utils');
jest.mock('../../src/utils/command_utils');

describe('generateAndCommitMessage', () => {
  const mockOptions = { silent: false };
  const mockPrompt = 'Mock commit message prompt';
  const mockRawCommitMessage = 'Raw commit message';
  const mockCleanCommitMessage = 'Clean commit message';

  beforeEach(() => {
    jest.clearAllMocks();
    (getConfig as jest.Mock).mockReturnValue({ silent: false });
    (generateCommitMessagePrompt as jest.Mock).mockReturnValue(mockPrompt);
    (extractMarkdown as jest.Mock).mockReturnValue(mockCleanCommitMessage);
  });

  it('should generate and commit a message successfully', async () => {
    const mockGenerateText = jest.fn().mockResolvedValue(mockRawCommitMessage);
    (ClovingGPT as jest.Mock).mockImplementation(() => ({
      generateText: mockGenerateText,
    }));

    await generateAndCommitMessage(mockOptions);

    expect(getConfig).toHaveBeenCalledWith(mockOptions);
    expect(ClovingGPT).toHaveBeenCalledWith(mockOptions);
    expect(generateCommitMessagePrompt).toHaveBeenCalled();
    expect(mockGenerateText).toHaveBeenCalledWith({ prompt: mockPrompt });
    expect(extractMarkdown).toHaveBeenCalledWith(mockRawCommitMessage);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('SUGGESTED_COMMIT_EDITMSG'),
      mockCleanCommitMessage
    );
    expect(execFileSync).toHaveBeenCalledWith(
      'git',
      ['commit', '-a', '--edit', '--file', expect.stringContaining('SUGGESTED_COMMIT_EDITMSG')],
      { stdio: 'inherit' }
    );
    expect(fs.unlink).toHaveBeenCalled();
  });

  it('should handle commit cancellation', async () => {
    const mockGenerateText = jest.fn().mockResolvedValue(mockRawCommitMessage);
    (ClovingGPT as jest.Mock).mockImplementation(() => ({
      generateText: mockGenerateText,
    }));
    (execFileSync as jest.Mock).mockImplementation(() => {
      throw new Error('Commit canceled');
    });

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await generateAndCommitMessage(mockOptions);

    expect(consoleSpy).toHaveBeenCalledWith('Commit was canceled or failed.');
    expect(fs.unlink).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle errors in generating commit message', async () => {
    const mockGenerateText = jest.fn().mockRejectedValue(new Error('Generation failed'));
    (ClovingGPT as jest.Mock).mockImplementation(() => ({
      generateText: mockGenerateText,
    }));

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    await generateAndCommitMessage(mockOptions);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Could not generate commit message');

    consoleErrorSpy.mockRestore();
  });
});
