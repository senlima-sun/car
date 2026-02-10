import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTireTrailStore, MAX_POINTS_PER_WHEEL } from '../../../../stores/useTireTrailStore'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'
import { tireTrailVertexShader, tireTrailFragmentShader } from '../../../../shaders/tireTrail'

const WET_INSTANCES = 800
const WET_WIDTH_MULT = 1.5
const Y_OFFSET = 0.005

const _matrix = new THREE.Matrix4()
const _rot = new THREE.Matrix4()

export default function WetTrails() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  const { geometry, colorAttr } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(0.30, 0.12)
    geo.rotateX(-Math.PI / 2)

    const colors = new Float32Array(WET_INSTANCES * 3)
    const attr = new THREE.InstancedBufferAttribute(colors, 3)
    attr.setUsage(THREE.DynamicDrawUsage)

    return { geometry: geo, colorAttr: attr }
  }, [])

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: tireTrailVertexShader,
      fragmentShader: tireTrailFragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  }, [])

  const prevCountRef = useRef(0)

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return

    if (rainIntensity < 0.01) {
      if (prevCountRef.current > 0) {
        mesh.count = 0
        prevCountRef.current = 0
      }
      return
    }

    const store = useTireTrailStore.getState()
    const { xs, zs, ys, dirXs, dirZs, intensities, widths, wet, counts } = store

    let instanceIdx = 0

    for (let w = 0; w < 4; w++) {
      const base = w * MAX_POINTS_PER_WHEEL
      const count = counts[w]

      for (let i = 0; i < count && instanceIdx < WET_INSTANCES; i++) {
        const idx = base + i

        if (intensities[idx] <= 0 || wet[idx] !== 1) continue

        const dx = dirXs[idx]
        const dz = dirZs[idx]
        const angle = Math.atan2(dx, dz)

        const w2 = widths[idx] * WET_WIDTH_MULT

        _rot.makeRotationY(angle)
        _matrix.makeScale(w2 / 0.30, 1, 1)
        _matrix.premultiply(_rot)
        _matrix.setPosition(xs[idx], ys[idx] + Y_OFFSET, zs[idx])

        mesh.setMatrixAt(instanceIdx, _matrix)
        colorAttr.setXYZ(instanceIdx, intensities[idx] * 0.6, 1, 0)
        instanceIdx++
      }
    }

    mesh.instanceMatrix.needsUpdate = true
    colorAttr.needsUpdate = true
    mesh.count = instanceIdx
    prevCountRef.current = instanceIdx
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, WET_INSTANCES]}
      frustumCulled={false}
    >
      <primitive object={colorAttr} attach="geometry-attributes-instanceColorAttr" />
    </instancedMesh>
  )
}
