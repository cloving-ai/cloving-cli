import ChatManager from '../managers/ChatManager';
import { getConfig } from '../utils/config_utils';
import type { ClovingGPTOptions } from '../utils/types';

const chat = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false;
  options.stream = true;
  const chatManager = new ChatManager(options);
  await chatManager.initialize();
};

export default chat;
