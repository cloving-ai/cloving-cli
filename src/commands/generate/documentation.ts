import DocumentationManager from '../../managers/DocumentationManager'
import type { ClovingGPTOptions } from '../../utils/types'

const documentation = async (options: ClovingGPTOptions) => {
  const documentationManager = new DocumentationManager(options)
  await documentationManager.generateDocumentation()
}

export default documentation
