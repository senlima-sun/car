import { useRef, useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useEnvironment, Environment } from '@react-three/drei'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { usePerformanceStore } from '@/stores/usePerformanceStore'
import { hdriSkyVertex, hdriSkyFragment } from '@/shaders/hdriSky'

const HDRI_PATH = '/textures/hdri/'
const CLEAR_FILE = 'DaySkyHDRI027B_2K_HDR.exr'
const RAIN_FILE = 'EveningSkyHDRI029B_2K_HDR.exr'
const CLOUDY_FILE = 'DaySkyHDRI021B_2K_HDR.exr'

useEnvironment.preload({ files: CLEAR_FILE, path: HDRI_PATH })
useEnvironment.preload({ files: RAIN_FILE, path: HDRI_PATH })
useEnvironment.preload({ files: CLOUDY_FILE, path: HDRI_PATH })

type BlendState = { texA: THREE.Texture; texB: THREE.Texture; target: number }

const SKY_ENV_DISABLE_FPS = 75
const SKY_ENV_ENABLE_FPS = 95

function computeBlendState(
  temperature: number,
  rainIntensity: number,
  clearTex: THREE.Texture,
  rainTex: THREE.Texture,
  cloudyTex: THREE.Texture,
): BlendState {
  if (rainIntensity > 0.01) {
    const baseTex = temperature < 0 ? cloudyTex : clearTex
    return { texA: baseTex, texB: rainTex, target: rainIntensity }
  }

  if (temperature < 0) {
    const t = Math.min(1, Math.abs(temperature) / 10)
    return { texA: clearTex, texB: cloudyTex, target: t }
  }

  return { texA: clearTex, texB: clearTex, target: 0 }
}

export function shouldEnableSkyEnvironment(avgFps: number, currentlyEnabled: boolean): boolean {
  if (currentlyEnabled) return avgFps >= SKY_ENV_DISABLE_FPS
  return avgFps >= SKY_ENV_ENABLE_FPS
}

export default function HdriSky() {
  const clearTex = useEnvironment({ files: CLEAR_FILE, path: HDRI_PATH })
  const rainTex = useEnvironment({ files: RAIN_FILE, path: HDRI_PATH })
  const cloudyTex = useEnvironment({ files: CLOUDY_FILE, path: HDRI_PATH })
  const avgFps = usePerformanceStore(s => s.avgFps)

  const matRef = useRef<THREE.ShaderMaterial>(null)
  const [environmentEnabled, setEnvironmentEnabled] = useState(true)

  const uniforms = useMemo(
    () => ({
      texA: { value: clearTex },
      texB: { value: clearTex },
      blend: { value: 0 },
      exposure: { value: 1.0 },
      uRotation: { value: 0 },
    }),
    [clearTex],
  )

  useFrame((_, delta) => {
    if (!matRef.current) return

    const { temperature, rainIntensity } = useEnvironmentStore.getState()
    const state = computeBlendState(
      temperature,
      rainIntensity,
      clearTex as THREE.Texture,
      rainTex as THREE.Texture,
      cloudyTex as THREE.Texture,
    )

    matRef.current.uniforms.texA.value = state.texA
    matRef.current.uniforms.texB.value = state.texB

    const current = matRef.current.uniforms.blend.value
    matRef.current.uniforms.blend.value += (state.target - current) * Math.min(1, delta * 2.0)

    matRef.current.uniforms.uRotation.value += 0.005 * delta
  })

  useEffect(() => {
    setEnvironmentEnabled(current => {
      const next = shouldEnableSkyEnvironment(avgFps, current)
      return next === current ? current : next
    })
  }, [avgFps])

  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  const dominantTex = useMemo(() => {
    if (rainIntensity > 0.5) return rainTex
    if (temperature < -5) return cloudyTex
    return clearTex
  }, [temperature, rainIntensity, clearTex, rainTex, cloudyTex])

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
      {environmentEnabled && <Environment map={dominantTex as THREE.Texture} background={false} />}
    </>
  )
}
