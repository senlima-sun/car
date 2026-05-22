import { useMemo, useRef, type ReactElement } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  RAY_HIT_MISS_SENTINEL,
  useTerrainDebugStore,
} from '../../../stores/useTerrainDebugStore'

const SEEK_RAY_LENGTH = 50
const HIT_COLOR = new THREE.Color('#22c55e')
const MISS_COLOR = new THREE.Color('#ef4444')

function makeLine(): { geometry: THREE.BufferGeometry; positions: Float32Array } {
  const positions = new Float32Array(6)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return { geometry, positions }
}

export function SuspensionRayGizmo(): ReactElement | null {
  const enabled = useTerrainDebugStore(s => s.enabled && s.showSuspensionRays)

  const lines = useMemo(() => [makeLine(), makeLine(), makeLine(), makeLine()], [])
  const materialsRef = useRef<THREE.LineBasicMaterial[]>([
    new THREE.LineBasicMaterial({ color: MISS_COLOR.clone() }),
    new THREE.LineBasicMaterial({ color: MISS_COLOR.clone() }),
    new THREE.LineBasicMaterial({ color: MISS_COLOR.clone() }),
    new THREE.LineBasicMaterial({ color: MISS_COLOR.clone() }),
  ])

  useFrame(() => {
    if (!enabled) return
    const data = useTerrainDebugStore.getState().rayData
    for (let i = 0; i < 4; i++) {
      const base = i * 7
      const ox = data[base]!
      const oy = data[base + 1]!
      const oz = data[base + 2]!
      const dx = data[base + 3]!
      const dy = data[base + 4]!
      const dz = data[base + 5]!
      const hitDist = data[base + 6]!
      const dist = hitDist === RAY_HIT_MISS_SENTINEL ? SEEK_RAY_LENGTH : hitDist
      const { geometry, positions } = lines[i]!
      positions[0] = ox
      positions[1] = oy
      positions[2] = oz
      positions[3] = ox + dx * dist
      positions[4] = oy + dy * dist
      positions[5] = oz + dz * dist
      const attr = geometry.getAttribute('position') as THREE.BufferAttribute
      attr.needsUpdate = true
      const targetColor = hitDist === RAY_HIT_MISS_SENTINEL ? MISS_COLOR : HIT_COLOR
      materialsRef.current[i]!.color.copy(targetColor)
    }
  })

  if (!enabled) return null

  return (
    <group renderOrder={1000}>
      {lines.map((line, i) => (
        // eslint-disable-next-line react/no-unknown-property
        <primitive
          key={i}
          object={
            new THREE.Line(line.geometry, materialsRef.current[i]!) as unknown as THREE.Object3D
          }
        />
      ))}
    </group>
  )
}
