import { describe, expect, test } from 'bun:test'
import { Vector3 } from 'three'
import { TRACK_EDGE_LINE_WIDTH } from '../../../constants/dimensions'
import { TRACK_LAYER_Y_OFFSETS } from '../../../constants/trackLayers'
import { buildRibbon } from './TrackRibbon'

describe('buildRibbon', () => {
  test('top-face triangles wind upward for rendering from above', () => {
    const ribbon = buildRibbon(
      [
        { x: 0, y: 0, z: 0, isPitLane: false },
        { x: 10, y: 0, z: 0, isPitLane: false },
      ],
      false,
      12,
    )

    expect(ribbon).not.toBeNull()

    const positions = ribbon!.mainGeometry.getAttribute('position')
    const indices = ribbon!.mainGeometry.getIndex()
    expect(indices).not.toBeNull()

    const i0 = indices!.getX(0)
    const i1 = indices!.getX(1)
    const i2 = indices!.getX(2)

    const a = new Vector3().fromBufferAttribute(positions, i0)
    const b = new Vector3().fromBufferAttribute(positions, i1)
    const c = new Vector3().fromBufferAttribute(positions, i2)

    const normalY = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).y

    expect(normalY).toBeGreaterThan(0)
  })

  test('places white edge lines inside the road surface', () => {
    const ribbon = buildRibbon(
      [
        { x: 0, y: 0, z: 0, isPitLane: false },
        { x: 10, y: 0, z: 0, isPitLane: false },
      ],
      false,
      12,
    )

    expect(ribbon).not.toBeNull()

    const leftPositions = ribbon!.leftEdgeGeometry!.getAttribute('position')
    const rightPositions = ribbon!.rightEdgeGeometry!.getAttribute('position')

    expect(leftPositions.getZ(0)).toBeCloseTo(6)
    expect(leftPositions.getZ(1)).toBeCloseTo(6 - TRACK_EDGE_LINE_WIDTH)
    expect(rightPositions.getZ(0)).toBeCloseTo(-6)
    expect(rightPositions.getZ(1)).toBeCloseTo(-6 + TRACK_EDGE_LINE_WIDTH)
  })

  test('keeps painted area above grass displacement and below white edge lines', () => {
    const ribbon = buildRibbon(
      [
        { x: 0, y: 0, z: 0, isPitLane: false },
        { x: 10, y: 0, z: 0, isPitLane: false },
      ],
      false,
      0.8,
    )

    expect(ribbon).not.toBeNull()

    const mainPositions = ribbon!.mainGeometry.getAttribute('position')
    const edgePositions = ribbon!.leftEdgeGeometry!.getAttribute('position')
    const paintedY = mainPositions.getY(0)
    const edgeY = edgePositions.getY(0)
    const grassVisualDisplacementMax = 0.04
    expect(paintedY).toBeCloseTo(TRACK_LAYER_Y_OFFSETS.ASPHALT, 6)

    expect(paintedY).toBeGreaterThan(grassVisualDisplacementMax)
    expect(paintedY).toBeLessThan(edgeY)
  })
})
