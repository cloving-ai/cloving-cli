import { EventEmitter } from 'events'

// A chunk is a JSON object with different keys depending on the AI service provider
//
// Some providers produce single response in a single chunk
//
// Others produce multiple responses in a single chunk
//
// This Chunk Manager's job is to buffer the chunks and emit them as a single string
// without automatically clearing the buffer until clearBuffer is called.
// That way, the consumer of the chunk can process it and clear the buffer after
// they have received enough data.
class ChunkManager extends EventEmitter {
  private buffer: string = ''

  addChunk(chunk: string | undefined) {
    if (!chunk) return
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
