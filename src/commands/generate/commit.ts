import type { ClovingGPTOptions } from '../../utils/types'
import CommitManager from '../../managers/CommitManager'

const commit = async (options: ClovingGPTOptions) => {
  const commitManager = new CommitManager(options)
  await commitManager.commit()
}

export default commit
