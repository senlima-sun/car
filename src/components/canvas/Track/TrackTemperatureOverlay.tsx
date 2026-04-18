import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  useTrackTemperatureStore,
  computeTrackBounds,
} from '../../../stores/useTrackTemperatureStore'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { useHeatmapStore } from '../../../stores/useHeatmapStore'
import {
  trackSurfaceVertexShader,
  trackSurfaceFragmentShader,
  WEATHER_TYPE_MAP,
} from '../../../shaders/trackSurface'
import { usePhysics } from '../../../wasm'
import { readStepBundle } from '../../../wasm/stepBundleSnapshot'

function computeWeatherType(temperature: number, rainIntensity: number): number {
  if (rainIntensity > 0.3) return WEATHER_TYPE_MAP.rain
  if (temperature < 5) return WEATHER_TYPE_MAP.cold
  if (temperature > 35) return WEATHER_TYPE_MAP.hot
  return WEATHER_TYPE_MAP.dry
}

export default function TrackTemperatureOverlay() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const frameCounter = useRef(0)
  const prevWeatherType = useRef(-1)
  const prevHeatmapVisible = useRef(false)

  const dataTexture = useTrackTemperatureStore(s => s.dataTexture)
  const setWorldBounds = useTrackTemperatureStore(s => s.setWorldBounds)
  const initializeTexture = useTrackTemperatureStore(s => s.initializeTexture)

  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)
  const isHeatmapVisible = useHeatmapStore(s => s.isVisible)

  const physics = usePhysics()

  const bounds = useMemo(() => computeTrackBounds(placedObjects), [placedObjects])

  useEffect(() => {
    initializeTexture()
  }, [initializeTexture])

  useEffect(() => {
    if (physics.initialized) {
      physics.initTrackTemperature(2, {
        min_x: bounds.minX,
        max_x: bounds.maxX,
        min_z: bounds.minZ,
        max_z: bounds.maxZ,
      })
      setWorldBounds(bounds)
    }
  }, [physics, physics.initialized, bounds, setWorldBounds])

  const uniforms = useMemo(
    () => ({
      temperatureMap: { value: null as THREE.DataTexture | null },
      worldBoundsMin: {
        value: new THREE.Vector2(bounds.minX, bounds.minZ),
      },
      worldBoundsMax: {
        value: new THREE.Vector2(bounds.maxX, bounds.maxZ),
      },
      weatherType: { value: WEATHER_TYPE_MAP.dry },
      ambientTemp: { value: 0.643 },
      ambientHumidity: { value: 0.3 },
      heatmapVisible: { value: false },
    }),
    [],
  )

  useFrame(() => {
    frameCounter.current++

    if (frameCounter.current % 6 === 0 && dataTexture && physics.initialized) {
      if (physics.isTrackTextureDirty()) {
        const wasmData = physics.getTrackTextureData()
        ;(dataTexture.image.data as Uint8Array).set(wasmData)
        dataTexture.needsUpdate = true
      }
    }

    if (materialRef.current) {
      materialRef.current.uniforms.temperatureMap.value = dataTexture

      const weatherType = computeWeatherType(temperature, rainIntensity)
      if (weatherType !== prevWeatherType.current) {
        materialRef.current.uniforms.weatherType.value = weatherType
        materialRef.current.uniforms.worldBoundsMin.value.set(bounds.minX, bounds.minZ)
        materialRef.current.uniforms.worldBoundsMax.value.set(bounds.maxX, bounds.maxZ)
        prevWeatherType.current = weatherType
      }

      if (isHeatmapVisible !== prevHeatmapVisible.current) {
        materialRef.current.uniforms.heatmapVisible.value = isHeatmapVisible
        prevHeatmapVisible.current = isHeatmapVisible
      }

      if (frameCounter.current % 6 === 0) {
        const { ambient } = readStepBundle()
        materialRef.current.uniforms.ambientTemp.value = ambient.temperature
        materialRef.current.uniforms.ambientHumidity.value = ambient.humidity
      }
    }
  })

  const overlayWidth = bounds.maxX - bounds.minX
  const overlayHeight = bounds.maxZ - bounds.minZ
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerZ = (bounds.minZ + bounds.maxZ) / 2

  return (
    <mesh position={[centerX, 0.03, centerZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={999}>
      <planeGeometry args={[overlayWidth, overlayHeight]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={trackSurfaceVertexShader}
        fragmentShader={trackSurfaceFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </mesh>
  )
}
