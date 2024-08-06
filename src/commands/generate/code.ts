import { getAllFiles } from '../../utils/config_utils'
import { getConfig } from '../../utils/config_utils'
import ClovingGPT from '../../cloving_gpt'
import CodeManager from '../../managers/CodeManager'
import type { ClovingGPTOptions } from '../../utils/types'

const code = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false
  const gpt = new ClovingGPT(options)
  const allSrcFiles = await getAllFiles(options, false)

  const codeManager = new CodeManager(gpt, options, allSrcFiles)
  if (options.prompt) {
    await codeManager.processCode(options.prompt)
  } else {
    console.error('No prompt provided.')
  }
}

export default code