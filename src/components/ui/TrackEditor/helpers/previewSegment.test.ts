import { describe, expect, it } from 'bun:test'
import type { Anchor, Path } from '../geometry/types'
import { worldToScreen, type Viewport } from '../geometry/viewport'
import { buildPreviewSegment } from './previewSegment'

const identityViewport: Viewport = { pan: { x: 0, y: 0 }, zoom: 1 }

function makeAnchor(point: { x: number; y: number }, outHandle?: { x: number; y: number }): Anchor {
  return {
    id: 'a',
    point,
    inHandle: { ...point },
    outHandle: outHandle ?? { ...point },
    handleType: 'corner',
  }
}

function makePath(id: string, anchors: Anchor[]): Path {
  return {
    id,
    anchors,
    closed: false,
    stroke: '#fff',
    strokeWidth: 1,
    fill: 'none',
  }
}

describe('buildPreviewSegment', () => {
  it('returns null when hoverWorld is missing', () => {
    const result = buildPreviewSegment({
      paths: [],
      viewport: identityViewport,
      pen: { activePathId: null, startRef: null },
      hoverWorld: null,
    })
    expect(result).toBeNull()
  })

  it('returns null when no active path and no startRef', () => {
    const result = buildPreviewSegment({
      paths: [],
      viewport: identityViewport,
      pen: { activePathId: null, startRef: null },
      hoverWorld: { x: 10, y: 0 },
    })
    expect(result).toBeNull()
  })

  it('returns null when active path has no anchors', () => {
    const path = makePath('p1', [])
    const result = buildPreviewSegment({
      paths: [path],
      viewport: identityViewport,
      pen: { activePathId: 'p1', startRef: null },
      hoverWorld: { x: 10, y: 0 },
    })
    expect(result).toBeNull()
  })

  it('produces M-L line when last anchor has no outHandle offset', () => {
    const anchor = makeAnchor({ x: 0, y: 0 })
    const path = makePath('p1', [anchor])
    const result = buildPreviewSegment({
      paths: [path],
      viewport: identityViewport,
      pen: { activePathId: 'p1', startRef: null },
      hoverWorld: { x: 10, y: 5 },
    })
    expect(result).toBe('M 0 0 L 10 5')
  })

  it('produces M-C cubic when last anchor has outHandle offset', () => {
    const anchor = makeAnchor({ x: 0, y: 0 }, { x: 3, y: 4 })
    const path = makePath('p1', [anchor])
    const result = buildPreviewSegment({
      paths: [path],
      viewport: identityViewport,
      pen: { activePathId: 'p1', startRef: null },
      hoverWorld: { x: 10, y: 5 },
    })
    expect(result).toBe('M 0 0 C 3 4 10 5 10 5')
  })

  it('uses worldToScreen for zoom/pan transforms', () => {
    const anchor = makeAnchor({ x: 0, y: 0 })
    const path = makePath('p1', [anchor])
    const viewport: Viewport = { pan: { x: 10, y: 10 }, zoom: 2 }
    const hover = { x: 5, y: 3 }

    const result = buildPreviewSegment({
      paths: [path],
      viewport,
      pen: { activePathId: 'p1', startRef: null },
      hoverWorld: hover,
    })

    const lastS = worldToScreen(viewport, anchor.point)
    const hoverS = worldToScreen(viewport, hover)
    expect(result).toBe(`M ${lastS.x} ${lastS.y} L ${hoverS.x} ${hoverS.y}`)
  })

  it('falls back to startRef when no active path', () => {
    const anchor = makeAnchor({ x: 1, y: 2 })
    const path = makePath('p1', [anchor])
    const result = buildPreviewSegment({
      paths: [path],
      viewport: identityViewport,
      pen: { activePathId: null, startRef: { pathId: 'p1', anchorIndex: 0 } },
      hoverWorld: { x: 10, y: 5 },
    })
    expect(result).toBe('M 1 2 L 10 5')
  })
})
