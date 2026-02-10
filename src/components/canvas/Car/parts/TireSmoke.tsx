import { useRef, useMemo, useEffect, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'
import type { CarState } from '../hooks/useCarFrame'
import { tireSmokeVertexShader, tireSmokeFragmentShader } from '../../../../shaders/tireSmoke'

const SMOKE_COUNT = 300
const DEBRIS_COUNT = 150

const WHEEL_OFFSETS = [
  { x: -0.76, z: 1.69, isFront: true },
  { x: 0.76, z: 1.69, isFront: true },
  { x: -0.765, z: -1.69, isFront: false },
  { x: 0.765, z: -1.69, isFront: false },
]

interface ParticlePool {
  positions: Float32Array
  velocities: Float32Array
  sizes: Float32Array
  opacities: Float32Array
  lifetimes: Float32Array
  maxLifetimes: Float32Array
  active: Uint8Array
}

function createPool(count: number, sizeMin: number, sizeMax: number, opacityMin: number, opacityMax: number, lifeMin: number, lifeMax: number): ParticlePool {
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const opacities = new Float32Array(count)
  const lifetimes = new Float32Array(count)
  const maxLifetimes = new Float32Array(count)
  const active = new Uint8Array(count)

  for (let i = 0; i < count; i++) {
    positions[i * 3 + 1] = -100
    sizes[i] = sizeMin + Math.random() * (sizeMax - sizeMin)
    opacities[i] = opacityMin + Math.random() * (opacityMax - opacityMin)
    maxLifetimes[i] = lifeMin + Math.random() * (lifeMax - lifeMin)
  }

  return { positions, velocities, sizes, opacities, lifetimes, maxLifetimes, active }
}

interface TireSmokeProps {
  carStateRef: MutableRefObject<CarState>
}

export default function TireSmoke({ carStateRef }: TireSmokeProps) {
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  const smokeRef = useRef<THREE.Points>(null)
  const debrisRef = useRef<THREE.Points>(null)

  const smokePool = useMemo(() => createPool(SMOKE_COUNT, 0.5, 2.5, 0.3, 0.6, 0.4, 1.2), [])
  const debrisPool = useMemo(() => createPool(DEBRIS_COUNT, 0.02, 0.08, 0.5, 0.8, 0.15, 0.35), [])

  const smokeGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(smokePool.positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(smokePool.sizes, 1))
    geo.setAttribute('opacity', new THREE.BufferAttribute(smokePool.opacities, 1))
    geo.setAttribute('lifetime', new THREE.BufferAttribute(smokePool.lifetimes, 1))
    return geo
  }, [smokePool])

  const debrisGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(debrisPool.positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(debrisPool.sizes, 1))
    geo.setAttribute('opacity', new THREE.BufferAttribute(debrisPool.opacities, 1))
    geo.setAttribute('lifetime', new THREE.BufferAttribute(debrisPool.lifetimes, 1))
    return geo
  }, [debrisPool])

  const smokeMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: tireSmokeVertexShader,
      fragmentShader: tireSmokeFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { baseColor: { value: new THREE.Color(0.7, 0.7, 0.7) } },
    })
  }, [])

  const debrisMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: tireSmokeVertexShader,
      fragmentShader: tireSmokeFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: { baseColor: { value: new THREE.Color(0.2, 0.2, 0.2) } },
    })
  }, [])

  useEffect(() => {
    return () => {
      smokeGeometry.dispose()
      debrisGeometry.dispose()
      smokeMaterial.dispose()
      debrisMaterial.dispose()
    }
  }, [smokeGeometry, debrisGeometry, smokeMaterial, debrisMaterial])

  const spawnAccum = useRef({ smoke: 0, debris: 0 })

  const hasActiveRef = useRef(false)

  useFrame((_, delta) => {
    if (rainIntensity > 0.3) return

    const { position, rotation, skidIntensity, isDrifting, isBraking, speedKmh } = carStateRef.current
    const skid = skidIntensity
    const braking = isBraking
    const speed = speedKmh / 3.6

    const shouldEmit = skid > 0.3 || isDrifting || (braking && speed > 22)

    if (!shouldEmit && !hasActiveRef.current) return

    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)

    const emitStrength = isDrifting ? 1.5 : skid > 0.3 ? skid : braking ? 0.6 : 0

    if (shouldEmit) {
      spawnAccum.current.smoke += delta * 200 * emitStrength
      spawnAccum.current.debris += delta * 100 * emitStrength
    }

    const spawnParticle = (
      pool: ParticlePool,
      index: number,
      wheelIdx: number,
      type: 'smoke' | 'debris',
    ) => {
      const wheel = WHEEL_OFFSETS[wheelIdx]
      const i3 = index * 3

      const spreadX = (Math.random() - 0.5) * 0.3
      const spreadZ = (Math.random() - 0.5) * 0.15
      const ox = wheel.x + spreadX
      const oz = wheel.z + spreadZ

      pool.positions[i3] = position.x + ox * cos - oz * sin
      pool.positions[i3 + 1] = 0.08 + Math.random() * 0.05
      pool.positions[i3 + 2] = position.z + ox * sin + oz * cos

      let upVel: number, sideVel: number, backVel: number

      if (type === 'smoke') {
        upVel = 1.5 + Math.random() * 2.5
        sideVel = (Math.random() - 0.5) * 2
        backVel = -0.5 - Math.random() * 1.5
      } else {
        upVel = 0.3 + Math.random() * 0.8
        sideVel = (Math.random() - 0.5) * 3
        backVel = -0.3 - Math.random() * 1
      }

      pool.velocities[i3] = sideVel * cos - backVel * sin
      pool.velocities[i3 + 1] = upVel
      pool.velocities[i3 + 2] = sideVel * sin + backVel * cos

      pool.lifetimes[index] = pool.maxLifetimes[index]
      pool.active[index] = 1
    }

    const updatePool = (
      pool: ParticlePool,
      geometry: THREE.BufferGeometry,
      count: number,
      type: 'smoke' | 'debris',
      gravity: number,
      drag: number,
    ) => {
      const pos = pool.positions
      const vel = pool.velocities
      const life = pool.lifetimes
      const maxLife = pool.maxLifetimes

      const key = type as keyof typeof spawnAccum.current
      let toSpawn = Math.floor(spawnAccum.current[key])
      spawnAccum.current[key] -= toSpawn

      for (let i = 0; i < count; i++) {
        if (pool.active[i]) {
          life[i] -= delta
          if (life[i] <= 0 || pos[i * 3 + 1] < 0) {
            pool.active[i] = 0
            pos[i * 3 + 1] = -100
          } else {
            pos[i * 3] += vel[i * 3] * delta
            pos[i * 3 + 1] += vel[i * 3 + 1] * delta
            pos[i * 3 + 2] += vel[i * 3 + 2] * delta

            vel[i * 3 + 1] -= gravity * delta
            vel[i * 3] *= drag
            vel[i * 3 + 1] *= drag
            vel[i * 3 + 2] *= drag

            if (type === 'smoke') {
              vel[i * 3] += (Math.random() - 0.5) * 1.5 * delta
              vel[i * 3 + 2] += (Math.random() - 0.5) * 1.5 * delta
            }

            const lifeRatio = life[i] / maxLife[i]
            ;(geometry.attributes.lifetime as THREE.BufferAttribute).setX(i, lifeRatio)
          }
        } else if (toSpawn > 0 && shouldEmit) {
          toSpawn--
          const wheelIdx = isDrifting
            ? Math.random() < 0.8 ? (Math.random() < 0.5 ? 2 : 3) : (Math.random() < 0.5 ? 0 : 1)
            : braking
              ? Math.random() < 0.7 ? (Math.random() < 0.5 ? 0 : 1) : (Math.random() < 0.5 ? 2 : 3)
              : Math.floor(Math.random() * 4)
          spawnParticle(pool, i, wheelIdx, type)
        }
      }

      geometry.attributes.position.needsUpdate = true
      geometry.attributes.lifetime.needsUpdate = true
    }

    updatePool(smokePool, smokeGeometry, SMOKE_COUNT, 'smoke', 2, 0.97)
    updatePool(debrisPool, debrisGeometry, DEBRIS_COUNT, 'debris', 12, 0.98)

    hasActiveRef.current = smokePool.active.some(v => v === 1) || debrisPool.active.some(v => v === 1)
  })

  return (
    <>
      <points ref={smokeRef} geometry={smokeGeometry} material={smokeMaterial} />
      <points ref={debrisRef} geometry={debrisGeometry} material={debrisMaterial} />
    </>
  )
}
