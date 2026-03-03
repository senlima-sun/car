import { TELEMETRY_STRIDE } from './channels'

const DEFAULT_CAPACITY = 14400

export interface TelemetryLap {
  data: Float32Array
  frameCount: number
  lapTime: number
  trackId: string
  timestamp: number
}

export class TelemetryRingBuffer {
  private buffer: Float32Array
  private capacity: number
  private head = 0
  private count = 0
  private lapStartIndex = 0

  constructor(capacity = DEFAULT_CAPACITY) {
    this.capacity = capacity
    this.buffer = new Float32Array(capacity * TELEMETRY_STRIDE)
  }

  write(frame: Float32Array | number[]): void {
    const offset = this.head * TELEMETRY_STRIDE
    if (frame instanceof Float32Array) {
      this.buffer.set(frame, offset)
    } else {
      for (let i = 0; i < TELEMETRY_STRIDE; i++) {
        this.buffer[offset + i] = frame[i]
      }
    }
    this.head = (this.head + 1) % this.capacity
    if (this.count < this.capacity) this.count++
  }

  markLapStart(): void {
    this.lapStartIndex = this.head
  }

  extractCurrentLap(lapTime: number, trackId: string): TelemetryLap | null {
    const startIdx = this.lapStartIndex
    const endIdx = this.head
    let frameCount: number

    if (endIdx >= startIdx) {
      frameCount = endIdx - startIdx
    } else {
      frameCount = this.capacity - startIdx + endIdx
    }

    if (frameCount <= 0) return null

    const data = new Float32Array(frameCount * TELEMETRY_STRIDE)

    if (endIdx >= startIdx) {
      data.set(
        this.buffer.subarray(
          startIdx * TELEMETRY_STRIDE,
          endIdx * TELEMETRY_STRIDE,
        ),
      )
    } else {
      const tailLen = this.capacity - startIdx
      data.set(
        this.buffer.subarray(
          startIdx * TELEMETRY_STRIDE,
          this.capacity * TELEMETRY_STRIDE,
        ),
      )
      data.set(
        this.buffer.subarray(0, endIdx * TELEMETRY_STRIDE),
        tailLen * TELEMETRY_STRIDE,
      )
    }

    return {
      data,
      frameCount,
      lapTime,
      trackId,
      timestamp: Date.now(),
    }
  }

  getChannel(channelOffset: number, maxFrames?: number): Float32Array {
    const n = maxFrames ? Math.min(maxFrames, this.count) : this.count
    const result = new Float32Array(n)
    let readIdx = this.head - n
    if (readIdx < 0) readIdx += this.capacity

    for (let i = 0; i < n; i++) {
      result[i] = this.buffer[readIdx * TELEMETRY_STRIDE + channelOffset]
      readIdx = (readIdx + 1) % this.capacity
    }

    return result
  }

  getRecentFrames(maxFrames: number): Float32Array {
    const n = Math.min(maxFrames, this.count)
    const result = new Float32Array(n * TELEMETRY_STRIDE)
    let readIdx = this.head - n
    if (readIdx < 0) readIdx += this.capacity

    for (let i = 0; i < n; i++) {
      const srcOff = readIdx * TELEMETRY_STRIDE
      result.set(
        this.buffer.subarray(srcOff, srcOff + TELEMETRY_STRIDE),
        i * TELEMETRY_STRIDE,
      )
      readIdx = (readIdx + 1) % this.capacity
    }

    return result
  }

  getFrameCount(): number {
    return this.count
  }

  getHead(): number {
    return this.head
  }

  reset(): void {
    this.head = 0
    this.count = 0
    this.lapStartIndex = 0
  }
}
