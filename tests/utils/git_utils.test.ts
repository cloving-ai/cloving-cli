import { getGitDiff, getDefaultBranchName, getCurrentBranchName } from '../../src/utils/git_utils';
import { execSync } from 'child_process';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

describe('gitUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getDefaultBranchName should return the default branch name', async () => {
    (execSync as jest.Mock).mockReturnValueOnce('main\n');
    const result = await getDefaultBranchName();
    expect(result).toBe('main');
  });

  test('getCurrentBranchName should return the current branch name', () => {
    (execSync as jest.Mock).mockReturnValueOnce('feature-branch\n');
    const result = getCurrentBranchName();
    expect(result).toBe('feature-branch');
  });
});