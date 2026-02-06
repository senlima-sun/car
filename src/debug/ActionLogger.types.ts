export type ActionCategory = 'input' | 'physics' | 'state' | 'system' | 'interaction'

export interface ActionEntry {
  id: number
  timestamp: number
  category: ActionCategory
  action: string
  payload: Record<string, unknown>
  result?: Record<string, unknown>
  duration?: number
  source: string
}

export interface ActionFilter {
  category?: ActionCategory
  action?: string | RegExp
  since?: number
  until?: number
  source?: string
  limit?: number
}

export interface ActionLoggerConfig {
  maxEntries: number
  enabled: boolean
}
