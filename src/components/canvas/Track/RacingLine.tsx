import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useLapTimeStore } from '../../../stores/useLapTimeStore'

const RIBBON_WIDTH = 0.5
const Y_OFFSET = 0.02

function buildRibbonGeometry(
  positions: Float32Array,
  speeds: Float32Array,
  count: number,
): THREE.BufferGeometry | null {
  if (count < 2) return null

  const vertCount = count * 2
  const verts = new Float32Array(vertCount * 3)
  const colors = new Float32Array(vertCount * 3)

  let minSpeed = Infinity
  let maxSpeed = -Infinity
  for (let i = 0; i < count; i++) {
    if (speeds[i] < minSpeed) minSpeed = speeds[i]
    if (speeds[i] > maxSpeed) maxSpeed = speeds[i]
  }
  const speedRange = Math.max(maxSpeed - minSpeed, 1)

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3]
    const y = positions[i * 3 + 1] + Y_OFFSET
    const z = positions[i * 3 + 2]

    let tx: number, tz: number
    if (i === 0) {
      tx = positions[3] - x
      tz = positions[5] - z
    } else if (i === count - 1) {
      tx = x - positions[(i - 1) * 3]
      tz = z - positions[(i - 1) * 3 + 2]
    } else {
      tx = positions[(i + 1) * 3] - positions[(i - 1) * 3]
      tz = positions[(i + 1) * 3 + 2] - positions[(i - 1) * 3 + 2]
    }

    const len = Math.sqrt(tx * tx + tz * tz)
    if (len > 0.001) {
      tx /= len
      tz /= len
    } else {
      tx = 0
      tz = 1
    }

    const nx = -tz * RIBBON_WIDTH * 0.5
    const nz = tx * RIBBON_WIDTH * 0.5

    const li = i * 2
    const ri = i * 2 + 1

    verts[li * 3] = x + nx
    verts[li * 3 + 1] = y
    verts[li * 3 + 2] = z + nz
    verts[ri * 3] = x - nx
    verts[ri * 3 + 1] = y
    verts[ri * 3 + 2] = z - nz

    const t = (speeds[i] - minSpeed) / speedRange

    let r: number, g: number, b: number
    if (t < 0.5) {
      const s = t * 2
      r = 1 - s * 0.2
      g = s * 1.0
      b = 0
    } else {
      const s = (t - 0.5) * 2
      r = 0.8 * (1 - s)
      g = 1.0 - s * 0.3
      b = 0
    }

    colors[li * 3] = r
    colors[li * 3 + 1] = g
    colors[li * 3 + 2] = b
    colors[ri * 3] = r
    colors[ri * 3 + 1] = g
    colors[ri * 3 + 2] = b
  }

  const indices: number[] = []
  for (let i = 0; i < count - 1; i++) {
    const bl = i * 2
    const br = i * 2 + 1
    const tl = (i + 1) * 2
    const tr = (i + 1) * 2 + 1
    indices.push(bl, br, tl)
    indices.push(br, tr, tl)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

export default function RacingLine() {
  const bestLapPath = useLapTimeStore(s => s.bestLapPath)
  const visible = useLapTimeStore(s => s.racingLineVisible)
  const geoRef = useRef<THREE.BufferGeometry | null>(null)

  const geometry = useMemo(() => {
    if (geoRef.current) {
      geoRef.current.dispose()
      geoRef.current = null
    }
    if (!bestLapPath || bestLapPath.count < 2) return null
    const geo = buildRibbonGeometry(bestLapPath.positions, bestLapPath.speeds, bestLapPath.count)
    geoRef.current = geo
    return geo
  }, [bestLapPath])

  useEffect(() => {
    return () => {
      if (geoRef.current) {
        geoRef.current.dispose()
      }
    }
  }, [])

  if (!geometry || !visible) return null

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.4}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
