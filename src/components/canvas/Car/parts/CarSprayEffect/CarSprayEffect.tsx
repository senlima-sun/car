import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { usePerformanceStore } from '@/stores/usePerformanceStore'
import { usePhysicsOptional } from '@/wasm'
import type { CarState } from '../../hooks/types'
import {
  DROPLET_COUNT,
  MIN_SPEED_FOR_SPRAY,
  MIST_COUNT,
  SPRAY_COUNT,
  SURFACE_SAMPLE_EVERY,
  WHEEL_POSITIONS,
} from './constants'
import {
  advanceParticle,
  deactivateParticle,
  initParticleData,
  type ParticleData,
  type ParticleKind,
} from './helpers/particles'
import { sprayFragmentShader, sprayVertexShader } from './shaders'

interface CarSprayEffectProps {
  carStateRef: MutableRefObject<CarState>
}

function buildGeometry(data: ParticleData) {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
  geo.setAttribute('size', new THREE.BufferAttribute(data.sizes, 1))
  geo.setAttribute('opacity', new THREE.BufferAttribute(data.opacities, 1))
  geo.setAttribute('lifetime', new THREE.BufferAttribute(data.lifetimes, 1))
  return geo
}

export default function CarSprayEffect({ carStateRef }: CarSprayEffectProps) {
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)
  const physics = usePhysicsOptional()

  const sprayRef = useRef<THREE.Points>(null)
  const mistRef = useRef<THREE.Points>(null)
  const dropletsRef = useRef<THREE.Points>(null)

  const sprayData = useMemo(() => initParticleData(SPRAY_COUNT, 'spray'), [])
  const mistData = useMemo(() => initParticleData(MIST_COUNT, 'mist'), [])
  const dropletData = useMemo(() => initParticleData(DROPLET_COUNT, 'droplet'), [])

  const sprayGeometry = useMemo(() => buildGeometry(sprayData), [sprayData])
  const mistGeometry = useMemo(() => buildGeometry(mistData), [mistData])
  const dropletGeometry = useMemo(() => buildGeometry(dropletData), [dropletData])

  const shaderMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: sprayVertexShader,
        fragmentShader: sprayFragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      sprayGeometry.dispose()
      mistGeometry.dispose()
      dropletGeometry.dispose()
      shaderMaterial.dispose()
    }
  }, [sprayGeometry, mistGeometry, dropletGeometry, shaderMaterial])

  const surfaceCache = useRef<{
    counter: number
    lastSampled: number
    condition: 'wet' | 'icy' | null
  }>({ counter: 0, lastSampled: 0, condition: null })

  const getSurfaceCondition = () => {
    surfaceCache.current.counter++
    if (surfaceCache.current.counter - surfaceCache.current.lastSampled < SURFACE_SAMPLE_EVERY) {
      return surfaceCache.current.condition
    }
    surfaceCache.current.lastSampled = surfaceCache.current.counter

    const { position: carPosition } = carStateRef.current
    let next: 'wet' | 'icy' | null = null
    if (rainIntensity > 0.01) {
      if (!physics?.initialized) {
        next = 'wet'
      } else {
        const wetness = physics.getTrackWetness(carPosition.x, carPosition.z)
        next = wetness > 0.2 ? 'wet' : null
      }
    } else if (temperature < 0) {
      if (physics?.initialized) {
        const waterDepth = physics.getWaterDepth(carPosition.x, carPosition.z)
        next = waterDepth > 0.1 ? 'icy' : null
      }
    }
    surfaceCache.current.condition = next
    return next
  }

  const spawnAccumulator = useRef({ spray: 0, mist: 0, droplet: 0 })
  const hasActiveRef = useRef(false)

  useFrame((_, delta) => {
    const {
      position: carPosition,
      velocity: carVelocity,
      rotation: carRotation,
    } = carStateRef.current
    const surfaceCondition = getSurfaceCondition()
    const shouldEmit = surfaceCondition && carVelocity > MIN_SPEED_FOR_SPRAY

    if (!shouldEmit && !hasActiveRef.current) return

    const speedFactor = Math.min(carVelocity / 30, 2)

    const cos = Math.cos(carRotation)
    const sin = Math.sin(carRotation)

    const pMult = usePerformanceStore.getState().particleMultiplier
    if (shouldEmit) {
      spawnAccumulator.current.spray += delta * 400 * speedFactor * pMult
      spawnAccumulator.current.mist += delta * 200 * speedFactor * pMult
      spawnAccumulator.current.droplet += delta * 100 * speedFactor * pMult
    }

    const spawnParticle = (
      data: ParticleData,
      index: number,
      wheelX: number,
      wheelZ: number,
      isRear: boolean,
      type: ParticleKind,
    ) => {
      const i3 = index * 3

      const spreadX = (Math.random() - 0.5) * 0.4
      const spreadZ = (Math.random() - 0.5) * 0.2
      const offsetX = wheelX + spreadX
      const offsetZ = wheelZ + spreadZ

      const worldX = offsetX * cos - offsetZ * sin
      const worldZ = offsetX * sin + offsetZ * cos

      data.positions[i3] = carPosition.x + worldX
      data.positions[i3 + 1] = 0.15 + Math.random() * 0.1
      data.positions[i3 + 2] = carPosition.z + worldZ

      let upVel: number, sideVel: number, backVel: number

      if (type === 'spray') {
        upVel = (3 + Math.random() * 4) * speedFactor
        sideVel = (Math.random() - 0.5) * 3 * speedFactor
        backVel = (-2 - Math.random() * 3) * speedFactor
        if (isRear) {
          upVel *= 1.3
          backVel *= 1.5
        } else {
          upVel *= 0.6
          backVel *= 0.7
        }
      } else if (type === 'mist') {
        upVel = (1 + Math.random() * 2) * speedFactor
        sideVel = (Math.random() - 0.5) * 4 * speedFactor
        backVel = (-1 - Math.random() * 2) * speedFactor
        if (!isRear) {
          upVel *= 0.5
          sideVel *= 0.7
        }
      } else {
        upVel = (2 + Math.random() * 2) * speedFactor
        sideVel = (Math.random() - 0.5) * 2 * speedFactor
        backVel = (-1.5 - Math.random() * 2) * speedFactor
      }

      data.velocities[i3] = sideVel * cos - backVel * sin
      data.velocities[i3 + 1] = upVel
      data.velocities[i3 + 2] = sideVel * sin + backVel * cos

      data.lifetimes[index] = data.maxLifetimes[index]
      data.active[index] = 1
      data.activeCount++
    }

    const updateParticles = (
      data: ParticleData,
      geometry: THREE.BufferGeometry,
      count: number,
      type: ParticleKind,
      gravity: number,
      drag: number,
    ) => {
      const pos = data.positions
      const life = data.lifetimes
      const maxLife = data.maxLifetimes

      const spawnKey = type as keyof typeof spawnAccumulator.current
      let toSpawn = Math.floor(spawnAccumulator.current[spawnKey])
      spawnAccumulator.current[spawnKey] -= toSpawn

      for (let i = 0; i < count; i++) {
        if (data.active[i]) {
          life[i] -= delta

          if (life[i] <= 0 || pos[i * 3 + 1] < 0) {
            deactivateParticle(data, i)
          } else {
            advanceParticle(data, i, delta, gravity, drag, type === 'mist')
            const lifeRatio = life[i] / maxLife[i]
            ;(geometry.attributes.lifetime as THREE.BufferAttribute).setX(i, lifeRatio)
          }
        } else if (toSpawn > 0 && shouldEmit) {
          toSpawn--
          const wheelIdx =
            Math.random() < 0.7
              ? Math.random() < 0.5
                ? 2
                : 3
              : Math.random() < 0.5
                ? 0
                : 1
          const wheel = WHEEL_POSITIONS[wheelIdx]
          spawnParticle(data, i, wheel.x, wheel.z, wheel.isRear, type)
        }
      }

      geometry.attributes.position.needsUpdate = true
      geometry.attributes.lifetime.needsUpdate = true
    }

    updateParticles(sprayData, sprayGeometry, SPRAY_COUNT, 'spray', 12, 0.98)
    updateParticles(mistData, mistGeometry, MIST_COUNT, 'mist', 3, 0.96)
    updateParticles(dropletData, dropletGeometry, DROPLET_COUNT, 'droplet', 20, 0.99)

    const totalActive =
      sprayData.activeCount + mistData.activeCount + dropletData.activeCount
    hasActiveRef.current = totalActive > 0
  })

  if (rainIntensity <= 0.01 && temperature >= 0) {
    return null
  }

  return (
    <>
      <points ref={sprayRef} geometry={sprayGeometry} material={shaderMaterial} />
      <points ref={mistRef} geometry={mistGeometry} material={shaderMaterial} />
      <points ref={dropletsRef} geometry={dropletGeometry} material={shaderMaterial} />
    </>
  )
}
