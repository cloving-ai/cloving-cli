import { config } from '../../src/commands/config';
import * as commandUtils from '../../src/utils/command_utils';

jest.mock('../../src/utils/command_utils');
jest.mock('../../src/cloving_gpt/adapters/openai');

describe('config', () => {
  let mockGetConfig: jest.SpyInstance;
  let mockFetchModels: jest.SpyInstance;
  let mockPromptUser: jest.SpyInstance;
  let mockSaveConfig: jest.SpyInstance;
  const mockModels = ['gpt-3.5-turbo', 'gpt-4'];

  beforeEach(() => {
    mockGetConfig = jest.spyOn(commandUtils, 'getConfig').mockReturnValue({ models: {} });
    mockPromptUser = jest.spyOn(commandUtils, 'promptUser');
    mockSaveConfig = jest.spyOn(commandUtils, 'saveConfig').mockImplementation(jest.fn());
    mockFetchModels = jest.spyOn(commandUtils, 'fetchModels').mockResolvedValue(mockModels);

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  it('should configure a single model successfully', async () => {
    mockPromptUser
      .mockResolvedValueOnce('1') // Select first model
      .mockResolvedValueOnce('api-key-1') // API key
      .mockResolvedValueOnce('y') // Set as primary
      .mockResolvedValueOnce('n'); // Don't configure another model

    await config();

    expect(mockGetConfig).toHaveBeenCalledWith({});
    expect(mockFetchModels).toHaveBeenCalled();
    expect(mockPromptUser).toHaveBeenCalledTimes(4);
    expect(mockSaveConfig).toHaveBeenCalledWith({
      models: { 'gpt-3.5-turbo': 'api-key-1' },
      primaryModel: 'gpt-3.5-turbo'
    });
  });

  it('should configure multiple models successfully', async () => {
    mockPromptUser
      .mockResolvedValueOnce('1') // Select first model
      .mockResolvedValueOnce('api-key-1') // API key
      .mockResolvedValueOnce('n') // Don't set as primary
      .mockResolvedValueOnce('y') // Configure another model
      .mockResolvedValueOnce('2') // Select second model
      .mockResolvedValueOnce('api-key-2') // API key
      .mockResolvedValueOnce('y') // Set as primary
      .mockResolvedValueOnce('n'); // Don't configure another model

    await config();

    expect(mockGetConfig).toHaveBeenCalledWith({});
    expect(mockFetchModels).toHaveBeenCalled();
    expect(mockPromptUser).toHaveBeenCalledTimes(8);
    expect(mockSaveConfig).toHaveBeenCalledWith({
      models: { 'gpt-3.5-turbo': 'api-key-1', 'gpt-4': 'api-key-2' },
      primaryModel: 'gpt-4'
    });
  });

  it('should throw an error if an invalid model selection is made', async () => {
    mockPromptUser.mockResolvedValueOnce('3'); // Invalid selection

    await expect(config()).rejects.toThrow('Invalid selection');
  });

  it('should use existing config if available', async () => {
    mockGetConfig.mockReturnValue({ models: { existingModel: 'existing-api-key' } });
    mockPromptUser
      .mockResolvedValueOnce('1') // Select first model
      .mockResolvedValueOnce('new-api-key') // API key
      .mockResolvedValueOnce('y') // Set as primary
      .mockResolvedValueOnce('n'); // Don't configure another model

    await config();

    expect(mockSaveConfig).toHaveBeenCalledWith({
      models: { existingModel: 'existing-api-key', 'gpt-3.5-turbo': 'new-api-key' },
      primaryModel: 'gpt-3.5-turbo'
    });
  });
});