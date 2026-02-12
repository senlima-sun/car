import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePerformanceStore } from '../../../../stores/usePerformanceStore'

interface Particle {
  pos: THREE.Vector3
  vel: THREE.Vector3
  lifetime: number
  maxLifetime: number
  phase: number
}

export function InstancedSnowSplash() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const { camera } = useThree()

  const puffCount = 200
  const areaSize = 120

  const { particles, geometry, material } = useMemo(() => {
    const particles: Particle[] = Array.from({ length: puffCount }, (_, i) => ({
      pos: new THREE.Vector3(0, -10, 0),
      vel: new THREE.Vector3(0, 0, 0),
      lifetime: 0,
      maxLifetime: 0.4 + Math.random() * 0.4,
      phase: i,
    }))

    const geometry = new THREE.SphereGeometry(0.25, 8, 8)
    const material = new THREE.MeshBasicMaterial({
      color: '#e8f4ff',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })

    return { particles, geometry, material }
  }, [])

  useEffect(() => {
    if (!meshRef.current) return

    const dummy = dummyRef.current
    for (let i = 0; i < puffCount; i++) {
      dummy.position.copy(particles[i].pos)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [particles])

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
    const snowMult = usePerformanceStore.getState().particleMultiplier
    const spawnRate = 25 * snowMult
    let toSpawn = Math.floor(spawnRate * delta)

    for (let i = 0; i < puffCount; i++) {
      const particle = particles[i]
      particle.lifetime -= delta

      if (particle.lifetime <= 0) {
        if (toSpawn > 0) {
          toSpawn--

          particle.pos.set(
            camera.position.x + (Math.random() - 0.5) * areaSize,
            0.1,
            camera.position.z + (Math.random() - 0.5) * areaSize
          )

          const angle = Math.random() * Math.PI * 2
          const speed = 0.3 + Math.random() * 0.5
          particle.vel.set(
            Math.cos(angle) * speed,
            0.2 + Math.random() * 0.3,
            Math.sin(angle) * speed
          )

          particle.lifetime = particle.maxLifetime
        } else {
          particle.pos.y = -10
        }
      } else {
        const drift = Math.sin(time * 2 + particle.phase) * 0.3
        particle.pos.x += (particle.vel.x + drift) * delta
        particle.pos.y += particle.vel.y * delta
        particle.pos.z += particle.vel.z * delta

        particle.vel.y -= 0.5 * delta
        particle.vel.x *= 0.98
        particle.vel.z *= 0.98

        if (particle.pos.y < 0) {
          particle.lifetime = 0
        }
      }

      dummy.position.copy(particle.pos)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, material, puffCount]} />
  )
}
