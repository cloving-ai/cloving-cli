import UnitTestManager from '../../managers/UnitTestManager'
import type { ClovingGPTOptions } from '../../utils/types'

const unitTests = async (options: ClovingGPTOptions) => {
  const unitTestManager = new UnitTestManager(options)
  await unitTestManager.generateUnitTests()
}

export default unitTests
