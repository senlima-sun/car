import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePerformanceStore } from '../../../../stores/usePerformanceStore'

export function InstancedHeat() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const { camera } = useThree()

  const particleCount = 300
  const areaSize = 80

  const { positions, velocities, geometry, material } = useMemo(() => {
    const positions = Array.from({ length: particleCount }, () => ({
      x: (Math.random() - 0.5) * areaSize,
      y: Math.random() * 5 + 0.5,
      z: (Math.random() - 0.5) * areaSize,
    }))

    const velocities = Array.from({ length: particleCount }, (_, i) => ({
      phase: i * 0.1,
    }))

    const geometry = new THREE.SphereGeometry(0.4, 8, 8)
    const material = new THREE.MeshBasicMaterial({
      color: '#ffcc88',
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    })

    return { positions, velocities, geometry, material }
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
      const vel = velocities[i]

      pos.x += Math.sin(time * 2 + vel.phase) * delta * 2
      pos.y += delta * (1 + Math.sin(time + i) * 0.5)
      pos.z += Math.cos(time * 2 + vel.phase) * delta * 2

      if (pos.y > 8) {
        pos.x = camera.position.x + (Math.random() - 0.5) * areaSize
        pos.y = Math.random() * 2 + 0.5
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
