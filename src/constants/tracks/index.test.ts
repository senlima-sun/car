import { describe, expect, test } from 'bun:test'
import {
  buildEdgeLineGeometry,
  buildParentSideBandGeometry,
} from '@/components/canvas/TrackObjects/geometry/ribbonGeometry'
import { TRACK_EDGE_LINE_WIDTH, TRACK_WIDTH } from '@/constants/dimensions'
import { PRESET_TRACKS } from './index'

describe('PRESET_TRACKS edge lines', () => {
  test('every preset edge line builds from its parent asphalt boundary', () => {
    for (const track of PRESET_TRACKS) {
      const ribbons = track.objects.filter(o => o.type === 'track_ribbon')
      const edgeLines = track.objects.filter(o => o.type === 'edge_line')

      expect(edgeLines.length).toBe(ribbons.length * 2)

      for (const edgeLine of edgeLines) {
        const parent = ribbons.find(ribbon => ribbon.id === edgeLine.parentRibbonId)

        expect(parent, `${track.id} ${edgeLine.id} parent exists`).toBeDefined()
        expect(parent!.ribbonPoints!.length, `${track.id} parent has points`).toBeGreaterThan(1)
        expect(edgeLine.parentSide, `${track.id} edge side exists`).toBeDefined()

        const geometry = buildEdgeLineGeometry(
          parent!.ribbonPoints!,
          parent!.ribbonClosed ?? false,
          parent!.width ?? TRACK_WIDTH,
          edgeLine.parentSide!,
          edgeLine.derivedWidth ?? edgeLine.width ?? TRACK_EDGE_LINE_WIDTH,
        )

        expect(geometry, `${track.id} edge geometry exists`).not.toBeNull()
        const segmentCount = parent!.ribbonClosed
          ? parent!.ribbonPoints!.length
          : parent!.ribbonPoints!.length - 1
        expect(geometry!.indices.length, `${track.id} edge segment count`).toBe(segmentCount * 6)
      }
    }
  })
})

describe('PRESET_TRACKS full-range painted areas', () => {
  test('every full-range painted area builds from its parent asphalt boundary', () => {
    for (const track of PRESET_TRACKS) {
      const ribbons = track.objects.filter(o => o.type === 'track_ribbon')
      const paintedAreas = track.objects.filter(
        o =>
          o.type === 'painted_area' &&
          (o.tRange === undefined || (o.tRange[0] === 0 && o.tRange[1] === 1)),
      )

      for (const paintedArea of paintedAreas) {
        const parent = ribbons.find(ribbon => ribbon.id === paintedArea.parentRibbonId)

        expect(parent, `${track.id} ${paintedArea.id} parent exists`).toBeDefined()
        expect(parent!.ribbonPoints!.length, `${track.id} parent has points`).toBeGreaterThan(1)
        expect(paintedArea.parentSide, `${track.id} painted side exists`).toBeDefined()

        const geometry = buildParentSideBandGeometry(
          parent!.ribbonPoints!,
          parent!.ribbonClosed ?? false,
          parent!.width ?? TRACK_WIDTH,
          paintedArea.parentSide!,
          paintedArea.innerOffset ?? 0,
          paintedArea.derivedWidth ?? paintedArea.width ?? TRACK_EDGE_LINE_WIDTH,
        )

        expect(geometry, `${track.id} painted geometry exists`).not.toBeNull()
        const segmentCount = parent!.ribbonClosed
          ? parent!.ribbonPoints!.length
          : parent!.ribbonPoints!.length - 1
        expect(geometry!.indices.length, `${track.id} painted segment count`).toBe(
          segmentCount * 6,
        )
      }
    }
  })
})
