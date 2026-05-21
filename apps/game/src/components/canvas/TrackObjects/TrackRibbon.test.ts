import { describe, expect, test } from 'vitest'
import { Vector3 } from 'three'
import { buildRibbonLayers } from './geometry/ribbonGeometry'

describe('buildRibbonLayers (ribbon-level invariants)', () => {
  test('top-face triangles wind upward for rendering from above', () => {
    const ribbon = buildRibbonLayers(
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
})
