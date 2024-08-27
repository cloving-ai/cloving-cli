import { EventEmitter } from 'events'
import { extractCurrentNewBlocks } from '../utils/string_utils'
import type { CurrentNewBlock } from '../utils/types'

/**
 * BlockManager class
 *
 * This class extends EventEmitter and manages the processing of code blocks within a stream of content.
 * It passes through string chunks, looking for code blocks. When it finds one, it starts buffering
 * until it finds the end of the block. Then it emits the code block, clears the buffer, and continues.
 */
class BlockManager extends EventEmitter {
  /** Stores non-code content */
  private buffer: string = ''
  /** Stores code block content */
  private codeBuffer: string = ''
  /** Indicates whether currently buffering a code block */
  private isBufferingCode: boolean = false
  /** Indicates whether waiting for more content to complete a block */
  private isWaitingForContent: boolean = false

  /**
   * Adds content to the buffer, watching for code blocks along the way.
   * @param {string} content - The content to be added and processed.
   */
  addContent(content: string) {
    if (content.includes('`') || content.includes('\n')) {
      this.isWaitingForContent = true
      this.buffer += content
      return
    } else if (this.isWaitingForContent) {
      content = this.buffer + content
      this.buffer = ''
    }

    // if content has multiple \n``` in the string, then we need to split it up

    if (content.includes('\n```')) {
      while (content.includes('\n```')) {
        const index = content.indexOf('\n```')
        this.processCodeBlocks(content.slice(0, index + 4))
        content = content.slice(index + 4)
      }
    }

    if (content !== '') {
      this.processCodeBlocks(content)
    }
  }

  /**
   * Processes the content for code blocks.
   * @param {string} content - The content to be processed for code blocks.
   * @private
   */
  private processCodeBlocks(content: string) {
    const codeBlockMarker = '\n```'
    let markerIndex = content.indexOf(codeBlockMarker)

    if (markerIndex !== -1) {
      if (this.isBufferingCode) {
        this.codeBuffer += content.slice(0, markerIndex + codeBlockMarker.length)
        const rest = content.slice(markerIndex + codeBlockMarker.length)
        this.emit('endGeneratingCode')
        this.emitCodeBlock()
        this.emit('content', rest)
      } else {
        this.emitBuffer(content.slice(0, markerIndex))
        this.codeBuffer = content.slice(markerIndex)
        this.emit('startGeneratingCode')
        this.isBufferingCode = true
      }
    } else {
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

  /**
   * Emits the buffered content as an event.
   * @param {string} additionalContent - Additional content to be emitted with the buffer.
   * @private
   */
  private emitBuffer(additionalContent: string = '') {
    const contentToEmit = this.buffer + additionalContent
    if (contentToEmit) {
      this.emit('content', contentToEmit)
      this.clearBuffer()
    }
  }

  /**
   * Emits the buffered code block as an event.
   * @private
   */
  private emitCodeBlock() {
    if (this.codeBuffer.length > 0) {
      const currentNewBlock = this.parseCodeBuffer()
      this.emit('codeBlock', {
        currentNewBlock,
        raw: this.codeBuffer,
      })
      this.emit('content', this.buffer)
      this.clearBuffer()
    }
  }

  /**
   * Parses a code buffer into its constituent parts.
   *
   * This function takes a code buffer as a string, splits it into lines, and identifies the language,
   * current start index, divider index, and new end index. It then extracts the current code and new code
   * from the buffer based on these indices.
   *
   * @return {CurrentNewBlock | null} An object containing the language, current start, new end, current code, and new code.
   * @private
   */
  private parseCodeBuffer(): CurrentNewBlock | null {
    const results = extractCurrentNewBlocks(this.codeBuffer)

    return results[0]
  }

  /**
   * Clears all buffers and resets state flags.
   */
  clearBuffer() {
    this.buffer = ''
    this.codeBuffer = ''
    this.isBufferingCode = false
    this.isWaitingForContent = false
  }
}

export default BlockManager
