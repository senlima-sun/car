import { renderToString } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { createElement } from 'react'
import type { CompletedLapSnapshot } from '@/stores/useGhostCarStore'

const exportGate = { allowed: true, reason: null as string | null }
let lastLap: CompletedLapSnapshot | null = null

vi.mock('@/auth/useFeatureGate', () => ({
  useFeatureGate: () => exportGate,
}))

vi.mock('@/stores/useGhostCarStore', () => ({
  useGhostCarStore: (selector: (s: unknown) => unknown) =>
    selector({ lastCompletedLap: lastLap }),
}))

vi.mock('@/stores/useTrackStore', () => ({
  useTrackStore: {
    getState: () => ({
      getActiveTrack: () => ({ presetId: 'f1_monaco' }),
      trackLibrary: { activeTrackId: null },
    }),
  },
}))

vi.mock('@/utils/aiDemoSchema', () => ({
  ghostBuffersToDemo: () => ({}),
}))

vi.mock('@/components/ui/primitives', () => ({
  Surface: ({ children, className }: { children?: unknown; className?: string }) =>
    createElement('div', { className }, children as never),
}))

const { ExportDemoButton } = await import('./ExportDemoButton')

function lapSnapshot(): CompletedLapSnapshot {
  return {
    lapTime: 92340,
    buffers: { frameCount: 1800 } as CompletedLapSnapshot['buffers'],
  } as CompletedLapSnapshot
}

function buttonBlock(html: string): string {
  const start = html.indexOf('<button')
  const end = html.indexOf('</button>')
  if (start === -1 || end === -1) throw new Error('button not found')
  return html.slice(start, end + '</button>'.length)
}

describe('ExportDemoButton', () => {
  test('free user with lap: button disabled with Pro label', () => {
    exportGate.allowed = false
    lastLap = lapSnapshot()
    const html = renderToString(<ExportDemoButton />)
    const btn = buttonBlock(html)
    expect(btn).toContain('disabled')
    expect(btn).toContain('Export demo JSON · Pro')
  })

  test('pro user with lap and slug: button enabled with frame/lap label', () => {
    exportGate.allowed = true
    lastLap = lapSnapshot()
    const html = renderToString(<ExportDemoButton />)
    const btn = buttonBlock(html)
    expect(btn).not.toMatch(/\sdisabled(=|>|\s)/)
    expect(btn).toContain('1800 frames')
    expect(btn).toContain('92.34s')
  })

  test('pro user with no lap: button disabled and label tells user to drive a lap', () => {
    exportGate.allowed = true
    lastLap = null
    const html = renderToString(<ExportDemoButton />)
    const btn = buttonBlock(html)
    expect(btn).toContain('disabled')
    expect(btn).toContain('drive a full lap')
  })
})
