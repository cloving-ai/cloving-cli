import ReviewManager from '../../managers/ReviewManager'
import type { ClovingGPTOptions } from '../../utils/types'

const review = async (options: ClovingGPTOptions) => {
  const reviewManager = new ReviewManager(options)
  await reviewManager.generateReview()
}

export default review
