import { EventEmitter } from 'events'
import { extractCurrentNewBlocks } from '../utils/string_utils'
import type { CurrentNewBlock } from '../utils/types'

// Passes through string chunks, looking for code blocks, when it finds one, it starts buffering until it finds the end of the block
// Then it emits the code block and clears the buffer and continues
class BlockManager extends EventEmitter {
  private buffer: string = ''
  private codeBuffer: string = ''
  private isBufferingCode: boolean = false
  private isWaitingForContent: boolean = false

  // add content to the buffer, watching for code blocks along the way
  addContent(content: string) {
    // when getting ` , just add it to the buffer until we get a char that isn't `
    if (content.includes('`')) {
      this.isWaitingForContent = true
      this.buffer += content
      return
    } else if (this.isWaitingForContent) {
      content = this.buffer + content
      this.buffer = ''
    }

    const codeBlockMarker = '\n```'

    let markerIndex = content.indexOf(codeBlockMarker)
    if (content.startsWith('```')) markerIndex = 0

    if (markerIndex !== -1) {
      if (this.isBufferingCode) {
        // End of code block
        this.codeBuffer += content.slice(0, markerIndex + codeBlockMarker.length)
        const rest = content.slice(markerIndex + codeBlockMarker.length)
        this.emit('endGeneratingCode')
        this.emitCodeBlock()
        this.emit('content', rest)
      } else {
        // Start of code block
        this.emitBuffer(content.slice(0, markerIndex))
        this.codeBuffer = content.slice(markerIndex)
        this.emit('startGeneratingCode')
        this.isBufferingCode = true
      }
    } else {
      // No code block marker found
      if (this.isBufferingCode) {
        this.codeBuffer += content
      } else {
        this.buffer += content
      }
    }

    if (!this.isBufferingCode && this.buffer) {
      this.emitBuffer()
    }
  }

  private emitBuffer(additionalContent: string = '') {
    const contentToEmit = this.buffer + additionalContent
    if (contentToEmit) {
      this.emit('content', contentToEmit)
      this.clearBuffer()
    }
  }

  private emitCodeBlock() {
    if (this.codeBuffer.length > 0) {
      const currentNewBlock = this.parseCodeBuffer()
      if (currentNewBlock) {
        this.emit('codeBlock', {
          currentNewBlock,
          raw: this.codeBuffer,
        })
        this.emit('content', this.buffer)
        this.clearBuffer()
      } else {
        this.emit('codeBlock', this.codeBuffer)
        this.clearBuffer()
      }
    }
  }

  /**
   * Parses a code buffer into its constituent parts.
   *
   * This function takes a code buffer as a string, splits it into lines, and identifies the language,
   * current start index, divider index, and new end index. It then extracts the current code and new code
   * from the buffer based on these indices.
   *
   * @return {CurrentNewBlock | null}
   *   An object containing the language, current start, new end, current code, and new code.
   */
  private parseCodeBuffer(): CurrentNewBlock | null {
    const results = extractCurrentNewBlocks(this.codeBuffer)

    return results[0]
  }

  clearBuffer() {
    this.buffer = ''
    this.codeBuffer = ''
    this.isBufferingCode = false
    this.isWaitingForContent = false
  }
}

export default BlockManager
