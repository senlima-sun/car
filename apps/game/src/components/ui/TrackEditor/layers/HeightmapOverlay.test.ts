import { describe, expect, it } from 'vitest'
import { selectHeightmapOverlayVersion } from './HeightmapOverlay'

describe('selectHeightmapOverlayVersion', () => {
  it('freezes contour invalidation while a terrain stroke is active', () => {
    expect(selectHeightmapOverlayVersion(12, true)).toBe(0)
  })

  it('passes through the terrain version when contour updates are allowed', () => {
    expect(selectHeightmapOverlayVersion(12, false)).toBe(12)
  })
})
