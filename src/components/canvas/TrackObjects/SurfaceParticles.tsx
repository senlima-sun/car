import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { useCarStore } from '../../../stores/useCarStore'
import { usePerformanceStore } from '../../../stores/usePerformanceStore'

const BASE_MAX_PARTICLES = 80
const MIN_SPEED_KMH = 20
const PARTICLE_LIFETIME = 1.2

const GRAVEL_COLORS = [
  new THREE.Color('#8a7f6d'),
  new THREE.Color('#a09080'),
  new THREE.Color('#706050'),
  new THREE.Color('#b8a88a'),
]

const GRASS_COLORS = [
  new THREE.Color('#4a6b3a'),
  new THREE.Color('#5a4530'),
  new THREE.Color('#3a5a2a'),
  new THREE.Color('#6b5a3a'),
]

interface Particle {
  active: boolean
  life: number
  maxLife: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  scale: number
  colorIndex: number
}

const tempMatrix = new THREE.Matrix4()
const tempColor = new THREE.Color()

export default function SurfaceParticles() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const particles = useRef<Particle[]>([])
  const spawnAccum = useRef(0)

  const geometry = useMemo(() => new THREE.BoxGeometry(0.04, 0.04, 0.04), [])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])

  if (particles.current.length === 0) {
    particles.current = Array.from({ length: BASE_MAX_PARTICLES }, () => ({
      active: false,
      life: 0,
      maxLife: PARTICLE_LIFETIME,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      scale: 1,
      colorIndex: 0,
    }))
  }

  useFrame((_state, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const dt = Math.min(delta, 0.05)
    const perfTier = usePerformanceStore.getState().tier
    const maxParticles = Math.floor(BASE_MAX_PARTICLES * (
      perfTier === 'ultra' ? 1.2 :
      perfTier === 'high' ? 1.0 :
      perfTier === 'medium' ? 0.6 : 0.3
    ))
    const surface = useSurfaceStore.getState().currentSurface
    const speed = useCarStore.getState().speed
    const position = useCarStore.getState().position
    const rotation = useCarStore.getState().rotation

    const isOffRoad = surface === 'grass' || surface === 'gravel'
    const isGravel = surface === 'gravel'
    const colors = isGravel ? GRAVEL_COLORS : GRASS_COLORS

    if (isOffRoad && speed > MIN_SPEED_KMH && position) {
      const speedFactor = Math.min((speed - MIN_SPEED_KMH) / 80, 1.0)
      const baseSpawnRate = 15 + speedFactor * 50
      const spawnRate = baseSpawnRate * (maxParticles / BASE_MAX_PARTICLES)
      spawnAccum.current += spawnRate * dt

      const yaw = rotation
        ? Math.atan2(
            2 * (rotation[3] * rotation[1] + rotation[0] * rotation[2]),
            1 - 2 * (rotation[1] ** 2 + rotation[0] ** 2),
          )
        : 0

      while (spawnAccum.current >= 1) {
        spawnAccum.current -= 1

        const p = particles.current.find(p => !p.active)
        if (!p) break

        const spreadX = (Math.random() - 0.5) * 1.5
        const spreadZ = (Math.random() - 0.5) * 1.5

        p.active = true
        p.life = 0
        p.maxLife = PARTICLE_LIFETIME * (0.7 + Math.random() * 0.6)
        p.x = position[0] + spreadX
        p.y = 0.05
        p.z = position[2] + spreadZ

        const backDir = -Math.sin(yaw)
        const backDirZ = -Math.cos(yaw)
        const ejectSpeed = isGravel
          ? 1.5 + speedFactor * 4.0
          : 0.8 + speedFactor * 2.0

        p.vx = backDir * ejectSpeed * (0.5 + Math.random()) + (Math.random() - 0.5) * 2
        p.vy = isGravel
          ? 2.0 + Math.random() * 3.0 * speedFactor
          : 0.5 + Math.random() * 1.5 * speedFactor
        p.vz = backDirZ * ejectSpeed * (0.5 + Math.random()) + (Math.random() - 0.5) * 2

        p.scale = isGravel
          ? 0.5 + Math.random() * 1.5
          : 0.3 + Math.random() * 0.8

        p.colorIndex = Math.floor(Math.random() * colors.length)
      }
    } else {
      spawnAccum.current = 0
    }

    let visibleCount = 0
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = particles.current[i]
      if (!p.active) {
        tempMatrix.makeScale(0, 0, 0)
        mesh.setMatrixAt(i, tempMatrix)
        continue
      }

      p.life += dt
      if (p.life >= p.maxLife) {
        p.active = false
        tempMatrix.makeScale(0, 0, 0)
        mesh.setMatrixAt(i, tempMatrix)
        continue
      }

      p.vy -= 9.8 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt

      if (p.y < 0) {
        p.y = 0
        p.vy *= -0.3
        p.vx *= 0.7
        p.vz *= 0.7
        if (Math.abs(p.vy) < 0.2) {
          p.vy = 0
          p.vx *= 0.9
          p.vz *= 0.9
        }
      }

      const t = p.life / p.maxLife
      const fadeScale = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1
      const s = p.scale * fadeScale * 0.04

      tempMatrix.makeScale(s, s, s)
      tempMatrix.setPosition(p.x, p.y, p.z)
      mesh.setMatrixAt(i, tempMatrix)

      tempColor.copy(colors[p.colorIndex % colors.length])
      mesh.setColorAt(i, tempColor)

      visibleCount++
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.count = MAX_PARTICLES
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, MAX_PARTICLES]}
      frustumCulled={false}
    />
  )
}
