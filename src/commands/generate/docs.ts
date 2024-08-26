import DocsManager from '../../managers/DocsManager'
import type { ClovingGPTOptions } from '../../utils/types'

const docs = async (options: ClovingGPTOptions) => {
  const docsManager = new DocsManager(options)
  await docsManager.generateDocumentation()
}

export default docs
