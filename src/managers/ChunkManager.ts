import { EventEmitter } from 'events'

class ChunkManager extends EventEmitter {
  private buffer: string = ''

  addChunk(chunk: string) {
    this.buffer += chunk
    this.emit('content', this.buffer)
  }

  clearBuffer(lastChar: number) {
    this.buffer = this.buffer.substring(lastChar)
  }

  getBuffer() {
    return this.buffer
  }
}

export default ChunkManager
