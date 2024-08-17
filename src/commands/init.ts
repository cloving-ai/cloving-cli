import InitManager from '../managers/InitManager'
import type { ClovingGPTOptions } from '../utils/types'

export const init = async (options: ClovingGPTOptions) => {
  const initManager = new InitManager(options)
  await initManager.initialize()
}

export default init
