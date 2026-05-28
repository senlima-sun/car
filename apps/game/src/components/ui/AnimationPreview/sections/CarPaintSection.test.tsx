import { renderToString } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { createElement } from 'react'

const shaderGate = { allowed: true, reason: null as string | null }

vi.mock('@/auth/useFeatureGate', () => ({
  useFeatureGate: () => shaderGate,
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => () => {},
}))

const paintState = {
  partColors: { body: '#0a1128' } as Record<string, string>,
  partMaterialSettings: { body: { roughness: 0.35, metalness: 0.4 } } as Record<
    string,
    { roughness: number; metalness: number }
  >,
  selectedPart: 'all' as 'all' | string,
  isolateSelected: false,
  flakeIntensity: 0.4,
  clearcoatStrength: 0.8,
  colorDepthFactor: 0.3,
  applyPreset: () => {},
  setPartColor: () => {},
  setPartRoughness: () => {},
  setPartMetalness: () => {},
  setActiveColor: () => {},
  setIsolateSelected: () => {},
  setActiveRoughness: () => {},
  setActiveMetalness: () => {},
  setFlakeIntensity: () => {},
  setClearcoatStrength: () => {},
  setColorDepthFactor: () => {},
}

vi.mock('@/stores/useCarPaintStore', () => {
  const hook = (selector: (s: unknown) => unknown) => selector(paintState)
  hook.getState = () => paintState
  return {
    useCarPaintStore: hook,
    PAINT_PRESETS: [
      { name: 'Midnight Blue', colors: { body: '#0a1128' } },
      { name: 'Crimson', colors: { body: '#a01020' } },
    ],
    DEFAULT_PART_MATERIAL_SETTINGS: { roughness: 0.35, metalness: 0.4 },
  }
})

vi.mock('../primitives/Chip', () => ({
  Chip: ({ label, onClick }: { label: string; onClick?: () => void }) =>
    createElement('button', { type: 'button', onClick, 'data-chip': label }, label),
}))

vi.mock('../primitives/Section', () => ({
  Section: ({ title, children }: { title: string; children?: unknown }) =>
    createElement('section', { 'data-section': title }, children as never),
}))

vi.mock('../primitives/ShowroomPanel', () => ({
  SwatchButton: ({ label, color }: { label: string; color: string }) =>
    createElement('button', {
      type: 'button',
      'data-swatch': label,
      'data-color': color,
    }),
}))

vi.mock('../primitives/Slider', () => ({
  Slider: ({ label, value }: { label: string; value: number }) =>
    createElement('div', { 'data-slider': label, 'data-value': value }),
}))

const { CarPaintSection } = await import('./CarPaintSection')

describe('CarPaintSection', () => {
  test('free user: Shader chip shows Pro upsell label', () => {
    shaderGate.allowed = false
    const html = renderToString(<CarPaintSection />)
    expect(html).toContain('Shader · Pro')
    expect(html).not.toMatch(/data-chip="Shader"/)
    expect(html).not.toMatch(/data-chip="Hide"/)
  })

  test('pro user: Shader chip is interactive, advanced sliders hidden until clicked', () => {
    shaderGate.allowed = true
    const html = renderToString(<CarPaintSection />)
    expect(html).toContain('data-chip="Shader"')
    expect(html).not.toContain('Shader · Pro')
    expect(html).not.toContain('data-slider="Roughness"')
    expect(html).not.toContain('data-slider="Metalness"')
  })

  test('free user: basic color input remains rendered', () => {
    shaderGate.allowed = false
    const html = renderToString(<CarPaintSection />)
    expect(html).toContain('type="color"')
    expect(html.toLowerCase()).toContain('#0a1128')
  })

  test('free user: preset swatch buttons are rendered', () => {
    shaderGate.allowed = false
    const html = renderToString(<CarPaintSection />)
    expect(html).toContain('data-swatch="Midnight Blue"')
    expect(html).toContain('data-swatch="Crimson"')
  })
})
