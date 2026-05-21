import { afterEach, describe, expect, test } from 'vitest'
import { pathToRibbon2D } from './pathToRibbon'
import { makeAnchor, makePath } from '../geometry/path'
import { TRACK_WIDTH } from '@/constants/dimensions'
import { useTerrainStore } from '@/stores/useTerrainStore'

const originalGetHeightAt = useTerrainStore.getState().getHeightAt

afterEach(() => {
  useTerrainStore.setState({ getHeightAt: originalGetHeightAt })
})

describe('pathToRibbon2D', () => {
  test('does not read from useTerrainStore.getHeightAt during sampling', () => {
    let callCount = 0
    useTerrainStore.setState({
      getHeightAt: () => {
        callCount++
        return 999
      },
    })

    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    const r = pathToRibbon2D(p)

    expect(r).not.toBeNull()
    expect(callCount).toBe(0)
  })

  test('emits ribbonPoints with y=0 and position with y=0', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 50 }))
    const r = pathToRibbon2D(p)
    expect(r).not.toBeNull()
    expect(r!.position[1]).toBe(0)
    for (const pt of r!.ribbonPoints!) {
      expect(pt.y).toBe(0)
    }
  })

  test('produces same x,z samples as pathToRibbon (terrain sampling does not affect xz)', async () => {
    const { pathToRibbon } = await import('./pathToRibbon')
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))

    const r2d = pathToRibbon2D(p)
    const r3d = pathToRibbon(p)
    expect(r2d).not.toBeNull()
    expect(r3d).not.toBeNull()
    const pts2d = r2d!.ribbonPoints!
    const pts3d = r3d!.ribbonPoints!
    expect(pts2d.length).toBe(pts3d.length)
    for (let i = 0; i < pts2d.length; i++) {
      expect(pts2d[i]!.x).toBeCloseTo(pts3d[i]!.x, 6)
      expect(pts2d[i]!.z).toBeCloseTo(pts3d[i]!.z, 6)
      expect(pts2d[i]!.isPitLane).toBe(pts3d[i]!.isPitLane)
    }
  })

  test('width and TRACK_WIDTH constant match', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    const r = pathToRibbon2D(p)
    expect(r!.width).toBe(TRACK_WIDTH)
  })

  test('returns null on degenerate single-anchor path', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    expect(pathToRibbon2D(p)).toBeNull()
  })

  test('preserves closed flag', () => {
    const p = makePath(makeAnchor({ x: 0, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 0 }))
    p.anchors.push(makeAnchor({ x: 100, y: 100 }))
    p.anchors.push(makeAnchor({ x: 0, y: 100 }))
    p.closed = true
    const r = pathToRibbon2D(p)
    expect(r!.ribbonClosed).toBe(true)
  })
})
