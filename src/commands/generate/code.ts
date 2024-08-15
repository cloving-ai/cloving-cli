import { getConfig } from '../../utils/config_utils'
import ChatManager from '../../managers/ChatManager'
import CodeManager from '../../managers/CodeManager'
import type { ClovingGPTOptions } from '../../utils/types'

const code = async (options: ClovingGPTOptions) => {
  if (options.interactive) {
    options.silent = getConfig(options).globalSilent || false
    options.stream = true
    const chatManager = new ChatManager(options)
    await chatManager.initialize()
  } else {
    const codeManager = new CodeManager(options)
    await codeManager.initialize()
  }
}

export default code
