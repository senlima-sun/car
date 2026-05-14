export type TabId = 'controls' | 'editor' | 'debug' | 'settings'

export type TabConfig = {
  id: TabId
  label: string
  debugOnly?: boolean
}

export const TABS: TabConfig[] = [
  { id: 'controls', label: 'Controls' },
  { id: 'editor', label: 'Editor' },
  { id: 'debug', label: 'Debug', debugOnly: true },
  { id: 'settings', label: 'Settings' },
]
