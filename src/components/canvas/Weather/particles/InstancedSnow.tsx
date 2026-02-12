import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePerformanceStore } from '../../../../stores/usePerformanceStore'

export function InstancedSnow() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const { camera } = useThree()

  const particleCount = 800
  const areaSize = 120

  const { positions, velocities, drifts, geometry, material } = useMemo(() => {
    const positions = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * areaSize,
      y: Math.random() * 60,
      z: (Math.random() - 0.5) * areaSize,
    }))

    const velocities = Array.from({ length: particleCount }, () => 3 + Math.random() * 4)

    const drifts = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2,
    }))

    const geometry = new THREE.SphereGeometry(0.2, 8, 8)
    const material = new THREE.MeshBasicMaterial({
      color: '#e8f0ff',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      depthTest: true,
    })

    return { positions, velocities, drifts, geometry, material }
  }, [])

  useEffect(() => {
    if (!meshRef.current) return

    const dummy = dummyRef.current
    for (let i = 0; i < particleCount; i++) {
      dummy.position.set(positions[i].x, positions[i].y, positions[i].z)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [positions])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame((state, delta) => {
    if (!meshRef.current) return

    const dummy = dummyRef.current
    const time = state.clock.elapsedTime
    const activeCount = Math.ceil(particleCount * usePerformanceStore.getState().particleMultiplier)

    for (let i = 0; i < activeCount; i++) {
      const pos = positions[i]
      const drift = drifts[i]

      pos.x += Math.sin(time + i) * drift.x * delta
      pos.y -= velocities[i] * delta
      pos.z += Math.cos(time + i) * drift.z * delta

      if (pos.y < 0) {
        pos.x = camera.position.x + (Math.random() - 0.5) * areaSize
        pos.y = 60
        pos.z = camera.position.z + (Math.random() - 0.5) * areaSize
      }

      dummy.position.set(pos.x, pos.y, pos.z)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, particleCount]} frustumCulled={false} />
  )
}
