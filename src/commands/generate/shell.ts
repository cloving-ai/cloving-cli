import ShellManager from '../../managers/ShellManager'
import type { ClovingGPTOptions } from '../../utils/types'

const shell = async (options: ClovingGPTOptions) => {
  const shellManager = new ShellManager(options)
  await shellManager.generateAndHandleShell()
}

export default shell
