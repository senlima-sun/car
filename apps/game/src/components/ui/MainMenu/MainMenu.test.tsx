import { renderToString } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { createElement, forwardRef } from 'react'

const timeTrialGate = { allowed: true, reason: null as string | null }
const editorGate = { allowed: true, reason: null as string | null }

vi.mock('@/auth/useFeatureGate', () => ({
  useFeatureGate: (feature: string) => {
    if (feature === 'timeTrial') return timeTrialGate
    if (feature === 'editor') return editorGate
    return { allowed: true, reason: null }
  },
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => {},
}))

vi.mock('@/components/ui/auth/AuthMenuButton', () => ({
  AuthMenuButton: () => null,
}))

vi.mock('@/stores/useGameStore', () => ({
  useGameStore: (selector: (s: unknown) => unknown) =>
    selector({
      enterSessionShell: () => {},
      openTrackEditor: () => {},
      openShowroom: () => {},
      openSettings: () => {},
    }),
}))

vi.mock('@/stores/useSessionStore', () => ({
  useSessionStore: (selector: (s: unknown) => unknown) =>
    selector({
      beginSessionFlow: () => {},
      startQuickSession: () => {},
    }),
}))

vi.mock('motion/react', () => {
  const motionTag = (tag: string) =>
    forwardRef((props: Record<string, unknown>, ref: unknown) => {
      const cleaned: Record<string, unknown> = {}
      for (const key of Object.keys(props)) {
        if (
          key === 'variants' ||
          key === 'initial' ||
          key === 'animate' ||
          key === 'whileHover' ||
          key === 'whileTap' ||
          key === 'transition' ||
          key === 'exit'
        ) continue
        cleaned[key] = props[key]
      }
      cleaned.ref = ref
      return createElement(tag, cleaned)
    })
  return {
    motion: {
      div: motionTag('div'),
      button: motionTag('button'),
      span: motionTag('span'),
      header: motionTag('header'),
      nav: motionTag('nav'),
      h1: motionTag('h1'),
    },
  }
})

const MainMenuModule = await import('./MainMenu')
const MainMenu = MainMenuModule.default

function buttonBlockFor(html: string, label: string): string {
  const labelMatch = new RegExp(`>${label}<`).exec(html)
  if (!labelMatch) throw new Error(`label not found: ${label}`)
  const start = html.lastIndexOf('<button', labelMatch.index)
  const end = html.indexOf('</button>', labelMatch.index)
  if (start === -1 || end === -1) throw new Error(`button block not located for ${label}`)
  return html.slice(start, end + '</button>'.length)
}

describe('MainMenu', () => {
  test('free user: Test and Editor buttons are aria-disabled with Pro badge', () => {
    timeTrialGate.allowed = false
    editorGate.allowed = false
    const html = renderToString(<MainMenu />)

    const testButton = buttonBlockFor(html, 'Test')
    const editorButton = buttonBlockFor(html, 'Editor')
    const raceButton = buttonBlockFor(html, 'Race')

    expect(testButton).toContain('aria-disabled="true"')
    expect(testButton).toContain('>Pro<')
    expect(editorButton).toContain('aria-disabled="true"')
    expect(editorButton).toContain('>Pro<')
    expect(raceButton).not.toContain('aria-disabled="true"')
  })

  test('pro user: Test and Editor buttons are not aria-disabled and no Pro badge', () => {
    timeTrialGate.allowed = true
    editorGate.allowed = true
    const html = renderToString(<MainMenu />)

    const testButton = buttonBlockFor(html, 'Test')
    const editorButton = buttonBlockFor(html, 'Editor')

    expect(testButton).not.toContain('aria-disabled="true"')
    expect(testButton).not.toContain('>Pro<')
    expect(editorButton).not.toContain('aria-disabled="true"')
    expect(editorButton).not.toContain('>Pro<')
  })

  test('Race button is never aria-disabled regardless of gates (server-enforced)', () => {
    timeTrialGate.allowed = false
    editorGate.allowed = false
    const freeHtml = renderToString(<MainMenu />)
    expect(buttonBlockFor(freeHtml, 'Race')).not.toContain('aria-disabled="true"')

    timeTrialGate.allowed = true
    editorGate.allowed = true
    const proHtml = renderToString(<MainMenu />)
    expect(buttonBlockFor(proHtml, 'Race')).not.toContain('aria-disabled="true"')
  })
})
