import { ConnectionManager } from './ConnectionManager'
import { encodeControlMessage, decodeControlMessage, isControlMessage } from './protocol'

export class LatencyMonitor {
  private connection: ConnectionManager
  private intervalId: ReturnType<typeof setInterval> | null = null
  private samples: number[] = []
  private maxSamples = 10
  private onLatency: (avg: number, status: 'good' | 'warning' | 'critical') => void

  constructor(
    connection: ConnectionManager,
    onLatency: (avg: number, status: 'good' | 'warning' | 'critical') => void,
  ) {
    this.connection = connection
    this.onLatency = onLatency
  }

  start() {
    this.intervalId = setInterval(() => {
      this.sendPing()
    }, 1000)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.samples = []
  }

  private sendPing() {
    const buffer = encodeControlMessage({ type: 'ping', timestamp: performance.now() })
    this.connection.send(buffer)
  }

  handlePong(timestamp: number) {
    const rtt = performance.now() - timestamp
    const latency = Math.round(rtt / 2)
    this.samples.push(latency)
    if (this.samples.length > this.maxSamples) {
      this.samples.shift()
    }
    const avg = Math.round(this.samples.reduce((a, b) => a + b, 0) / this.samples.length)
    const status = avg > 200 ? 'critical' : avg > 100 ? 'warning' : 'good'
    this.onLatency(avg, status)
  }
}
