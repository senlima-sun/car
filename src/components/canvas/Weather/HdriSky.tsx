import { useRef, useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEnvironment, Environment } from '@react-three/drei'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { usePerformanceStore } from '@/stores/usePerformanceStore'
import { useWeatherSourcesStore } from '@/stores/useWeatherSourcesStore'
import { hdriSkyVertex, hdriSkyFragment } from '@/shaders/hdriSky'

const MAX_WEATHER_SOURCES = 8
import {
  HDRI_PATH,
  SKY_STATE_IDS,
  SKY_STATES,
  pickTopStates,
  type BlendInputs,
  type SkyState,
} from './skyStates'

for (const id of SKY_STATE_IDS) {
  useEnvironment.preload({ files: SKY_STATES[id].file, path: HDRI_PATH })
}

const SKY_ENV_DISABLE_FPS = 75
const SKY_ENV_ENABLE_FPS = 95

export function shouldEnableSkyEnvironment(avgFps: number, currentlyEnabled: boolean): boolean {
  if (currentlyEnabled) return avgFps >= SKY_ENV_DISABLE_FPS
  return avgFps >= SKY_ENV_ENABLE_FPS
}

export default function HdriSky() {
  const clearTex = useEnvironment({
    files: SKY_STATES.clear.file,
    path: HDRI_PATH,
  }) as THREE.Texture
  const cloudyTex = useEnvironment({
    files: SKY_STATES.cloudy.file,
    path: HDRI_PATH,
  }) as THREE.Texture
  const overcastTex = useEnvironment({
    files: SKY_STATES.overcast.file,
    path: HDRI_PATH,
  }) as THREE.Texture
  const drizzleTex = useEnvironment({
    files: SKY_STATES.drizzle.file,
    path: HDRI_PATH,
  }) as THREE.Texture
  const heavyRainTex = useEnvironment({
    files: SKY_STATES.heavyRain.file,
    path: HDRI_PATH,
  }) as THREE.Texture
  const stormTex = useEnvironment({
    files: SKY_STATES.storm.file,
    path: HDRI_PATH,
  }) as THREE.Texture
  const goldenHourTex = useEnvironment({
    files: SKY_STATES.goldenHour.file,
    path: HDRI_PATH,
  }) as THREE.Texture
  const overcastDuskTex = useEnvironment({
    files: SKY_STATES.overcastDusk.file,
    path: HDRI_PATH,
  }) as THREE.Texture

  const textures = useMemo<Record<SkyState, THREE.Texture>>(
    () => ({
      clear: clearTex,
      cloudy: cloudyTex,
      overcast: overcastTex,
      drizzle: drizzleTex,
      heavyRain: heavyRainTex,
      storm: stormTex,
      goldenHour: goldenHourTex,
      overcastDusk: overcastDuskTex,
    }),
    [
      clearTex,
      cloudyTex,
      overcastTex,
      drizzleTex,
      heavyRainTex,
      stormTex,
      goldenHourTex,
      overcastDuskTex,
    ],
  )

  const avgFps = usePerformanceStore(s => s.avgFps)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const [environmentEnabled, setEnvironmentEnabled] = useState(true)
  const [environmentMapId, setEnvironmentMapId] = useState<SkyState>('clear')
  const dominantIdRef = useRef<SkyState>('clear')

  const activeIdsRef = useRef<SkyState[]>(['clear', 'clear', 'clear', 'heavyRain'])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (dominantIdRef.current !== environmentMapId) {
        setEnvironmentMapId(dominantIdRef.current)
      }
    }, 500)
    return () => window.clearInterval(id)
  }, [environmentMapId])

  const uniforms = useMemo(
    () => ({
      tex0: { value: textures.clear },
      exposure: { value: 1.0 },
      uRotation: { value: 0 },
      uTime: { value: 0 },
      uWeatherSources: {
        value: Array.from({ length: MAX_WEATHER_SOURCES }, () => new THREE.Vector4(0, 0, 0, 0)),
      },
      uWeatherSourceCount: { value: 0 },
      uCameraXZ: { value: new THREE.Vector2(0, 0) },
      uSourceBiasStrength: { value: 0.6 },
    }),
    [textures],
  )

  const pollAcc = useRef(0)
  const dominantStateRef = useRef<SkyState>('clear')

  useFrame((state, delta) => {
    if (!matRef.current) return
    const u = matRef.current.uniforms

    pollAcc.current += delta
    if (pollAcc.current >= 0.1) {
      pollAcc.current = 0
      const { temperature, rainIntensity, isDusk } = useEnvironmentStore.getState()
      const input: BlendInputs = { temperature, rainIntensity, isDusk }
      const ids = pickTopStates(input, 1)
      dominantStateRef.current = ids[0]
      activeIdsRef.current = [ids[0], ids[0], ids[0], 'heavyRain']
    }

    const dominant = dominantStateRef.current
    u.tex0.value = textures[dominant]

    const lerpFactor = Math.min(1, delta * 2.0)
    const dominantExposure = SKY_STATES[dominant].exposure
    const rotationSpeed = SKY_STATES[dominant].rotationSpeed
    u.exposure.value += (dominantExposure - u.exposure.value) * lerpFactor
    u.uRotation.value += rotationSpeed * delta
    u.uTime.value = state.clock.elapsedTime

    const sources = useWeatherSourcesStore.getState().sources
    const slots = u.uWeatherSources.value as THREE.Vector4[]
    const limit = Math.min(sources.length, MAX_WEATHER_SOURCES)
    for (let i = 0; i < limit; i++) {
      const s = sources[i]
      slots[i].set(s.x, s.z, s.radius, s.intensity)
    }
    if (u.uWeatherSourceCount.value !== limit) {
      for (let i = limit; i < MAX_WEATHER_SOURCES; i++) {
        slots[i].set(0, 0, 0, 0)
      }
      u.uWeatherSourceCount.value = limit
    }

    const cam = state.camera.position
    ;(u.uCameraXZ.value as THREE.Vector2).set(cam.x, cam.z)

    dominantIdRef.current = dominant
  })

  useEffect(() => {
    setEnvironmentEnabled(current => {
      const next = shouldEnableSkyEnvironment(avgFps, current)
      return next === current ? current : next
    })
  }, [avgFps])

  return (
    <>
      <mesh renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[1, 32, 16]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={hdriSkyVertex}
          fragmentShader={hdriSkyFragment}
          uniforms={uniforms}
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>
      {environmentEnabled && (
        <Environment
          map={textures[environmentMapId]}
          background={false}
          environmentIntensity={0.8}
        />
      )}
    </>
  )
}
