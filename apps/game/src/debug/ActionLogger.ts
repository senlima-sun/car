import type {
  ActionEntry,
  ActionFilter,
  ActionCategory,
  ActionLoggerConfig,
} from './ActionLogger.types'

type WaitPredicate = (entry: ActionEntry) => boolean

interface PendingWaiter {
  predicate: WaitPredicate
  resolve: (entry: ActionEntry) => void
  timer: ReturnType<typeof setTimeout>
}

class DevActionLogger {
  private buffer: ActionEntry[] = []
  private nextId = 1
  private config: ActionLoggerConfig
  private waiters: PendingWaiter[] = []

  constructor(config?: Partial<ActionLoggerConfig>) {
    this.config = {
      maxEntries: 1000,
      enabled: true,
      ...config,
    }
  }

  log(
    category: ActionCategory,
    action: string,
    source: string,
    payload: Record<string, unknown> = {},
    result?: Record<string, unknown>,
    duration?: number,
  ): ActionEntry | null {
    if (!this.config.enabled) return null

    const entry: ActionEntry = {
      id: this.nextId++,
      timestamp: performance.now(),
      category,
      action,
      source,
      payload,
      result,
      duration,
    }

    this.buffer.push(entry)

    if (this.buffer.length > this.config.maxEntries) {
      this.buffer.splice(0, this.buffer.length - this.config.maxEntries)
    }

    this.notifyWaiters(entry)

    return entry
  }

  query(filter: ActionFilter): ActionEntry[] {
    let entries = this.buffer

    if (filter.category) {
      entries = entries.filter(e => e.category === filter.category)
    }

    if (filter.action) {
      if (typeof filter.action === 'string') {
        const pattern = filter.action
        entries = entries.filter(e => e.action.includes(pattern))
      } else {
        const regex = filter.action
        entries = entries.filter(e => regex.test(e.action))
      }
    }

    if (filter.source) {
      entries = entries.filter(e => e.source === filter.source)
    }

    if (filter.since != null) {
      entries = entries.filter(e => e.timestamp >= filter.since!)
    }

    if (filter.until != null) {
      entries = entries.filter(e => e.timestamp <= filter.until!)
    }

    if (filter.limit != null) {
      entries = entries.slice(-filter.limit)
    }

    return entries
  }

  last(n: number): ActionEntry[] {
    return this.buffer.slice(-n)
  }

  clear(): void {
    this.buffer = []
  }

  snapshot(): ActionEntry[] {
    return [...this.buffer]
  }

  size(): number {
    return this.buffer.length
  }

  waitFor(predicate: WaitPredicate, timeoutMs = 5000): Promise<ActionEntry> {
    const existing = this.buffer.find(predicate)
    if (existing) return Promise.resolve(existing)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex(w => w.resolve === resolve)
        if (idx !== -1) this.waiters.splice(idx, 1)
        reject(new Error(`waitFor timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.waiters.push({ predicate, resolve, timer })
    })
  }

  getActionChain(triggerAction: string, windowMs = 500): ActionEntry[] {
    const trigger = [...this.buffer].reverse().find(e => e.action === triggerAction)
    if (!trigger) return []

    return this.buffer.filter(
      e => e.timestamp >= trigger.timestamp && e.timestamp <= trigger.timestamp + windowMs,
    )
  }

  assertSequence(actions: string[]): { pass: boolean; found: string[]; missing: string[] } {
    let searchFrom = 0
    const found: string[] = []
    const missing: string[] = []

    for (const action of actions) {
      const idx = this.buffer.findIndex((e, i) => i >= searchFrom && e.action === action)
      if (idx !== -1) {
        found.push(action)
        searchFrom = idx + 1
      } else {
        missing.push(action)
      }
    }

    return { pass: missing.length === 0, found, missing }
  }

  getStats(): Record<string, number> {
    const stats: Record<string, number> = { total: this.buffer.length }
    for (const entry of this.buffer) {
      stats[entry.category] = (stats[entry.category] ?? 0) + 1
    }
    return stats
  }

  exportJSON(): string {
    return JSON.stringify(this.buffer, null, 2)
  }

  exportTimeline(): string {
    return this.buffer
      .map(e => {
        const ts = e.timestamp.toFixed(1)
        const result = e.result ? ` → ${JSON.stringify(e.result)}` : ''
        return `[${ts}ms] [${e.category}] ${e.action} ${JSON.stringify(e.payload)}${result}`
      })
      .join('\n')
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled
  }

  setMaxEntries(max: number): void {
    this.config.maxEntries = max
    if (this.buffer.length > max) {
      this.buffer.splice(0, this.buffer.length - max)
    }
  }

  private notifyWaiters(entry: ActionEntry): void {
    const matched: number[] = []

    for (let i = 0; i < this.waiters.length; i++) {
      const waiter = this.waiters[i]
      if (waiter.predicate(entry)) {
        clearTimeout(waiter.timer)
        waiter.resolve(entry)
        matched.push(i)
      }
    }

    for (let i = matched.length - 1; i >= 0; i--) {
      this.waiters.splice(matched[i], 1)
    }
  }
}

let instance: DevActionLogger | null = null

export function getLogger(): DevActionLogger {
  if (!instance) {
    instance = new DevActionLogger()
  }
  return instance
}

export function createLogger(config?: Partial<ActionLoggerConfig>): DevActionLogger {
  instance = new DevActionLogger(config)
  return instance
}

export { DevActionLogger }
