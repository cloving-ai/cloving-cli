import unitTests from '../../../src/commands/generate/unit_tests';
import ClovingGPT from '../../../src/cloving_gpt';

jest.mock('../../../src/utils/git_utils', () => ({
  getGitDiff: jest.fn(),
}));

jest.mock('../../../src/cloving_gpt');

describe('unitTests', () => {
  const mockOptions = { files: ['src/cloving_gpt/adapters/ollama.ts'], silent: true, save: true };
  const mockGenerateText = jest.fn();
  const gpt = new ClovingGPT(mockOptions);

  beforeEach(() => {
    (ClovingGPT as jest.Mock).mockImplementation(() => ({
      generateText: mockGenerateText,
    }));
    jest.clearAllMocks();
  });

  test('should generate unit tests for provided files', async () => {
    mockGenerateText.mockResolvedValueOnce('Generated unit tests content');
    await unitTests(mockOptions);
    expect(mockGenerateText).toHaveBeenCalled();
  });
});