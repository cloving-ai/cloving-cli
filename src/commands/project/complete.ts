import { removeProjectConfig, getConfig } from '../../utils/config_utils'
import { getCurrentBranchName } from '../../utils/git_utils'
import type { ClovingGPTOptions } from '../../utils/types'

export const completeProject = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false

  const projectName = getCurrentBranchName()
  removeProjectConfig(projectName)
}

export default completeProject
