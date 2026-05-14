import { useRef, useMemo, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePerformanceStore } from '../../../../stores/usePerformanceStore'

interface Particle {
  pos: THREE.Vector3
  vel: THREE.Vector3
  lifetime: number
  maxLifetime: number
}

export function InstancedRainSplash() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummyRef = useRef(new THREE.Object3D())
  const { camera } = useThree()

  const splashCount = 300
  const areaSize = 120

  const { particles, geometry, material } = useMemo(() => {
    const particles: Particle[] = Array.from({ length: splashCount }, () => ({
      pos: new THREE.Vector3(0, -10, 0),
      vel: new THREE.Vector3(0, 0, 0),
      lifetime: 0,
      maxLifetime: 0.15 + Math.random() * 0.2,
    }))

    const geometry = new THREE.SphereGeometry(0.125, 8, 8)
    const material = new THREE.MeshBasicMaterial({
      color: '#aaccee',
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    return { particles, geometry, material }
  }, [])

  useEffect(() => {
    if (!meshRef.current) return

    const dummy = dummyRef.current
    for (let i = 0; i < splashCount; i++) {
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

  useFrame((_, delta) => {
    if (!meshRef.current) return

    const dummy = dummyRef.current
    const mult = usePerformanceStore.getState().particleMultiplier
    const spawnRate = 100 * mult
    let toSpawn = Math.floor(spawnRate * delta)

    for (let i = 0; i < splashCount; i++) {
      const particle = particles[i]
      particle.lifetime -= delta

      if (particle.lifetime <= 0) {
        if (toSpawn > 0) {
          toSpawn--

          particle.pos.set(
            camera.position.x + (Math.random() - 0.5) * areaSize,
            0.05,
            camera.position.z + (Math.random() - 0.5) * areaSize,
          )

          const angle = Math.random() * Math.PI * 2
          const speed = 1.5 + Math.random() * 2
          particle.vel.set(Math.cos(angle) * speed * 0.5, speed, Math.sin(angle) * speed * 0.5)

          particle.lifetime = particle.maxLifetime
        } else {
          particle.pos.y = -10
        }
      } else {
        particle.pos.addScaledVector(particle.vel, delta)
        particle.vel.y -= 12 * delta

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

  return <instancedMesh ref={meshRef} args={[geometry, material, splashCount]} />
}
