import { useRef, useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEnvironment, Environment } from '@react-three/drei'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { usePerformanceStore } from '@/stores/usePerformanceStore'
import { hdriSkyVertex, hdriSkyFragment } from '@/shaders/hdriSky'
import {
  HDRI_PATH,
  SKY_STATE_IDS,
  SKY_STATES,
  pickTopStates,
  computeWeights,
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

function deriveBlendInputs(temperature: number, rainIntensity: number): BlendInputs {
  return { temperature, rainIntensity, isDusk: false }
}

export default function HdriSky() {
  const textures: Record<SkyState, THREE.Texture> = {
    clear: useEnvironment({ files: SKY_STATES.clear.file, path: HDRI_PATH }) as THREE.Texture,
    cloudy: useEnvironment({ files: SKY_STATES.cloudy.file, path: HDRI_PATH }) as THREE.Texture,
    overcast: useEnvironment({ files: SKY_STATES.overcast.file, path: HDRI_PATH }) as THREE.Texture,
    drizzle: useEnvironment({ files: SKY_STATES.drizzle.file, path: HDRI_PATH }) as THREE.Texture,
    heavyRain: useEnvironment({
      files: SKY_STATES.heavyRain.file,
      path: HDRI_PATH,
    }) as THREE.Texture,
    storm: useEnvironment({ files: SKY_STATES.storm.file, path: HDRI_PATH }) as THREE.Texture,
    goldenHour: useEnvironment({
      files: SKY_STATES.goldenHour.file,
      path: HDRI_PATH,
    }) as THREE.Texture,
    overcastDusk: useEnvironment({
      files: SKY_STATES.overcastDusk.file,
      path: HDRI_PATH,
    }) as THREE.Texture,
  }

  const avgFps = usePerformanceStore(s => s.avgFps)
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const [environmentEnabled, setEnvironmentEnabled] = useState(true)
  const [dominantId, setDominantId] = useState<SkyState>('clear')

  const targetWeightsRef = useRef(new THREE.Vector4(1, 0, 0, 0))
  const activeIdsRef = useRef<SkyState[]>(['clear', 'clear', 'clear', 'clear'])

  const uniforms = useMemo(
    () => ({
      tex0: { value: textures.clear },
      tex1: { value: textures.clear },
      tex2: { value: textures.clear },
      tex3: { value: textures.clear },
      blendWeights: { value: new THREE.Vector4(1, 0, 0, 0) },
      exposure: { value: 1.0 },
      uRotation: { value: 0 },
      uTime: { value: 0 },
    }),
    [textures.clear],
  )

  useFrame((_, delta) => {
    if (!matRef.current) return

    const { temperature, rainIntensity } = useEnvironmentStore.getState()
    const input = deriveBlendInputs(temperature, rainIntensity)
    const ids = pickTopStates(input, 4)
    const weights = computeWeights(input, ids)

    activeIdsRef.current = ids
    targetWeightsRef.current.set(
      weights[0] ?? 0,
      weights[1] ?? 0,
      weights[2] ?? 0,
      weights[3] ?? 0,
    )

    const u = matRef.current.uniforms
    u.tex0.value = textures[ids[0]]
    u.tex1.value = textures[ids[1]]
    u.tex2.value = textures[ids[2]]
    u.tex3.value = textures[ids[3]]

    const current = u.blendWeights.value as THREE.Vector4
    const lerpFactor = Math.min(1, delta * 2.0)
    current.lerp(targetWeightsRef.current, lerpFactor)

    const dominantExposure = SKY_STATES[ids[0]].exposure
    const rotationSpeed = SKY_STATES[ids[0]].rotationSpeed
    u.exposure.value += (dominantExposure - u.exposure.value) * lerpFactor
    u.uRotation.value += rotationSpeed * delta
    u.uTime.value += delta

    if (ids[0] !== dominantId) setDominantId(ids[0])
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
      {environmentEnabled && <Environment map={textures[dominantId]} background={false} />}
    </>
  )
}
