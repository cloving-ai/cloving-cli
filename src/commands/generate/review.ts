import ClovingGPT from '../../cloving_gpt'
import ReviewManager from '../../managers/ReviewManager'
import { getConfig } from '../../utils/config_utils'
import type { ClovingGPTOptions } from '../../utils/types'

const review = async (options: ClovingGPTOptions) => {
  options.silent = getConfig(options).globalSilent || false
  const gpt = new ClovingGPT(options)
  
  const reviewManager = new ReviewManager(gpt, options)
  await reviewManager.review()
}

export default review