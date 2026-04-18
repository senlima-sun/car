import { useRef, useMemo, useEffect, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEnvironmentStore } from '../../../../stores/useEnvironmentStore'
import { usePerformanceStore } from '../../../../stores/usePerformanceStore'
import { usePhysicsOptional } from '../../../../wasm'
import type { CarState } from '../hooks/types'

const MIN_SPEED_FOR_SPRAY = 8 // m/s (~29 km/h)

// Wheel positions
const WHEEL_POSITIONS = [
  { x: -0.95, z: 1.6, isRear: false }, // Front Left
  { x: 0.95, z: 1.6, isRear: false }, // Front Right
  { x: -0.95, z: -1.2, isRear: true }, // Rear Left
  { x: 0.95, z: -1.2, isRear: true }, // Rear Right
]

// Vertex shader for spray particles with size and opacity variation
const sprayVertexShader = /* glsl */ `
  attribute float size;
  attribute float opacity;
  attribute float lifetime;

  varying float vOpacity;
  varying float vLifetime;

  void main() {
    vOpacity = opacity;
    vLifetime = lifetime;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Size attenuation
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_PointSize = clamp(gl_PointSize, 1.0, 64.0);
  }
`

// Fragment shader for realistic water mist appearance
const sprayFragmentShader = /* glsl */ `
  varying float vOpacity;
  varying float vLifetime;

  void main() {
    // Soft circular particle
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);

    // Soft edge falloff
    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);

    // Fade based on lifetime (fade out as particle ages)
    alpha *= vOpacity * vLifetime;

    if (alpha < 0.01) discard;

    // Water color - white core fading to light blue
    vec3 coreColor = vec3(0.95, 0.97, 1.0);
    vec3 edgeColor = vec3(0.7, 0.85, 0.95);
    vec3 color = mix(coreColor, edgeColor, dist * 2.0);

    gl_FragColor = vec4(color, alpha);
  }
`

interface CarSprayEffectProps {
  carStateRef: MutableRefObject<CarState>
}

interface ParticleData {
  positions: Float32Array
  velocities: Float32Array
  sizes: Float32Array
  opacities: Float32Array
  lifetimes: Float32Array
  maxLifetimes: Float32Array
  active: Uint8Array
  activeCount: number
}

export default function CarSprayEffect({ carStateRef }: CarSprayEffectProps) {
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)
  const physics = usePhysicsOptional()

  // Main spray particles (medium water droplets)
  const sprayRef = useRef<THREE.Points>(null)
  const SPRAY_COUNT = 800

  // Fine mist particles (small, float longer)
  const mistRef = useRef<THREE.Points>(null)
  const MIST_COUNT = 600

  // Large droplets (few, fall fast)
  const dropletsRef = useRef<THREE.Points>(null)
  const DROPLET_COUNT = 200

  // Initialize particle data
  const sprayData = useMemo((): ParticleData => {
    const positions = new Float32Array(SPRAY_COUNT * 3)
    const velocities = new Float32Array(SPRAY_COUNT * 3)
    const sizes = new Float32Array(SPRAY_COUNT)
    const opacities = new Float32Array(SPRAY_COUNT)
    const lifetimes = new Float32Array(SPRAY_COUNT)
    const maxLifetimes = new Float32Array(SPRAY_COUNT)
    const active = new Uint8Array(SPRAY_COUNT)

    for (let i = 0; i < SPRAY_COUNT; i++) {
      positions[i * 3 + 1] = -100 // Hidden
      sizes[i] = 0.15 + Math.random() * 0.2
      opacities[i] = 0.5 + Math.random() * 0.3
      maxLifetimes[i] = 0.4 + Math.random() * 0.4
    }

    return { positions, velocities, sizes, opacities, lifetimes, maxLifetimes, active, activeCount: 0 }
  }, [])

  const mistData = useMemo((): ParticleData => {
    const positions = new Float32Array(MIST_COUNT * 3)
    const velocities = new Float32Array(MIST_COUNT * 3)
    const sizes = new Float32Array(MIST_COUNT)
    const opacities = new Float32Array(MIST_COUNT)
    const lifetimes = new Float32Array(MIST_COUNT)
    const maxLifetimes = new Float32Array(MIST_COUNT)
    const active = new Uint8Array(MIST_COUNT)

    for (let i = 0; i < MIST_COUNT; i++) {
      positions[i * 3 + 1] = -100
      sizes[i] = 0.3 + Math.random() * 0.5 // Larger for mist cloud effect
      opacities[i] = 0.15 + Math.random() * 0.2 // More transparent
      maxLifetimes[i] = 0.8 + Math.random() * 0.8 // Lives longer
    }

    return { positions, velocities, sizes, opacities, lifetimes, maxLifetimes, active, activeCount: 0 }
  }, [])

  const dropletData = useMemo((): ParticleData => {
    const positions = new Float32Array(DROPLET_COUNT * 3)
    const velocities = new Float32Array(DROPLET_COUNT * 3)
    const sizes = new Float32Array(DROPLET_COUNT)
    const opacities = new Float32Array(DROPLET_COUNT)
    const lifetimes = new Float32Array(DROPLET_COUNT)
    const maxLifetimes = new Float32Array(DROPLET_COUNT)
    const active = new Uint8Array(DROPLET_COUNT)

    for (let i = 0; i < DROPLET_COUNT; i++) {
      positions[i * 3 + 1] = -100
      sizes[i] = 0.08 + Math.random() * 0.1 // Smaller, denser drops
      opacities[i] = 0.7 + Math.random() * 0.3 // More opaque
      maxLifetimes[i] = 0.3 + Math.random() * 0.3 // Short lived
    }

    return { positions, velocities, sizes, opacities, lifetimes, maxLifetimes, active, activeCount: 0 }
  }, [])

  // Create geometries
  const sprayGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(sprayData.positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sprayData.sizes, 1))
    geo.setAttribute('opacity', new THREE.BufferAttribute(sprayData.opacities, 1))
    geo.setAttribute('lifetime', new THREE.BufferAttribute(sprayData.lifetimes, 1))
    return geo
  }, [sprayData])

  const mistGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mistData.positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(mistData.sizes, 1))
    geo.setAttribute('opacity', new THREE.BufferAttribute(mistData.opacities, 1))
    geo.setAttribute('lifetime', new THREE.BufferAttribute(mistData.lifetimes, 1))
    return geo
  }, [mistData])

  const dropletGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(dropletData.positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(dropletData.sizes, 1))
    geo.setAttribute('opacity', new THREE.BufferAttribute(dropletData.opacities, 1))
    geo.setAttribute('lifetime', new THREE.BufferAttribute(dropletData.lifetimes, 1))
    return geo
  }, [dropletData])

  // Shader material
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: sprayVertexShader,
      fragmentShader: sprayFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, [])

  useEffect(() => {
    return () => {
      sprayGeometry.dispose()
      mistGeometry.dispose()
      dropletGeometry.dispose()
      shaderMaterial.dispose()
    }
  }, [sprayGeometry, mistGeometry, dropletGeometry, shaderMaterial])

  const surfaceCache = useRef<{ frame: number; condition: 'wet' | 'icy' | null }>({
    frame: 0,
    condition: null,
  })
  const frameCounterRef = useRef(0)
  const SURFACE_SAMPLE_EVERY = 15

  const getSurfaceCondition = () => {
    frameCounterRef.current++
    if (frameCounterRef.current - surfaceCache.current.frame < SURFACE_SAMPLE_EVERY) {
      return surfaceCache.current.condition
    }
    surfaceCache.current.frame = frameCounterRef.current

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

    // Helper to spawn a particle
    const spawnParticle = (
      data: ParticleData,
      index: number,
      wheelX: number,
      wheelZ: number,
      isRear: boolean,
      type: 'spray' | 'mist' | 'droplet',
    ) => {
      const i3 = index * 3

      // Position at wheel with spread
      const spreadX = (Math.random() - 0.5) * 0.4
      const spreadZ = (Math.random() - 0.5) * 0.2
      const offsetX = wheelX + spreadX
      const offsetZ = wheelZ + spreadZ

      // Rotate to world space
      const worldX = offsetX * cos - offsetZ * sin
      const worldZ = offsetX * sin + offsetZ * cos

      data.positions[i3] = carPosition.x + worldX
      data.positions[i3 + 1] = 0.15 + Math.random() * 0.1
      data.positions[i3 + 2] = carPosition.z + worldZ

      // Velocity based on type
      let upVel: number, sideVel: number, backVel: number

      if (type === 'spray') {
        // Main rooster tail - goes up and back
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
        // Fine mist - spreads out, rises slowly
        upVel = (1 + Math.random() * 2) * speedFactor
        sideVel = (Math.random() - 0.5) * 4 * speedFactor
        backVel = (-1 - Math.random() * 2) * speedFactor
        if (!isRear) {
          upVel *= 0.5
          sideVel *= 0.7
        }
      } else {
        // Droplets - fall faster, less spread
        upVel = (2 + Math.random() * 2) * speedFactor
        sideVel = (Math.random() - 0.5) * 2 * speedFactor
        backVel = (-1.5 - Math.random() * 2) * speedFactor
      }

      // Rotate velocity to world space
      data.velocities[i3] = sideVel * cos - backVel * sin
      data.velocities[i3 + 1] = upVel
      data.velocities[i3 + 2] = sideVel * sin + backVel * cos

      data.lifetimes[index] = data.maxLifetimes[index]
      data.active[index] = 1
      data.activeCount++
    }

    // Update and spawn particles for each type
    const updateParticles = (
      data: ParticleData,
      geometry: THREE.BufferGeometry,
      count: number,
      type: 'spray' | 'mist' | 'droplet',
      gravity: number,
      drag: number,
    ) => {
      const pos = data.positions
      const vel = data.velocities
      const life = data.lifetimes
      const maxLife = data.maxLifetimes

      // Get spawn count for this type
      const spawnKey = type as keyof typeof spawnAccumulator.current
      let toSpawn = Math.floor(spawnAccumulator.current[spawnKey])
      spawnAccumulator.current[spawnKey] -= toSpawn

      for (let i = 0; i < count; i++) {
        if (data.active[i]) {
          life[i] -= delta

          if (life[i] <= 0 || pos[i * 3 + 1] < 0) {
            data.active[i] = 0
            data.activeCount--
            pos[i * 3 + 1] = -100
          } else {
            // Update position
            pos[i * 3] += vel[i * 3] * delta
            pos[i * 3 + 1] += vel[i * 3 + 1] * delta
            pos[i * 3 + 2] += vel[i * 3 + 2] * delta

            // Apply gravity
            vel[i * 3 + 1] -= gravity * delta

            // Apply drag
            vel[i * 3] *= drag
            vel[i * 3 + 1] *= drag
            vel[i * 3 + 2] *= drag

            // Add turbulence for mist
            if (type === 'mist') {
              vel[i * 3] += (Math.random() - 0.5) * 2 * delta
              vel[i * 3 + 2] += (Math.random() - 0.5) * 2 * delta
            }

            // Update lifetime attribute for shader
            const lifeRatio = life[i] / maxLife[i]
            ;(geometry.attributes.lifetime as THREE.BufferAttribute).setX(i, lifeRatio)
          }
        } else if (toSpawn > 0 && shouldEmit) {
          toSpawn--
          // Pick a wheel (prefer rear wheels)
          const wheelIdx =
            Math.random() < 0.7
              ? Math.random() < 0.5
                ? 2
                : 3 // Rear wheels
              : Math.random() < 0.5
                ? 0
                : 1 // Front wheels
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

    hasActiveRef.current =
      sprayData.activeCount > 0 || mistData.activeCount > 0 || dropletData.activeCount > 0
  })

  // Only render when raining or cold
  if (rainIntensity <= 0.01 && temperature >= 0) {
    return null
  }

  return (
    <>
      {/* Main spray */}
      <points ref={sprayRef} geometry={sprayGeometry} material={shaderMaterial} />
      {/* Fine mist cloud */}
      <points ref={mistRef} geometry={mistGeometry} material={shaderMaterial} />
      {/* Large droplets */}
      <points ref={dropletsRef} geometry={dropletGeometry} material={shaderMaterial} />
    </>
  )
}
