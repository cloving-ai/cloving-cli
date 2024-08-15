import ProxyManager from '../managers/ProxyManager';
import type { ClovingGPTOptions } from '../utils/types';

const proxy = async (options: ClovingGPTOptions) => {
  const proxyManager = new ProxyManager(options);
  await proxyManager.initialize();
};

export default proxy;
