import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  useTrackTemperatureStore,
  TRACK_TEMP_CONFIG,
} from '../../../stores/useTrackTemperatureStore'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { useHeatmapStore } from '../../../stores/useHeatmapStore'
import {
  trackSurfaceVertexShader,
  trackSurfaceFragmentShader,
  WEATHER_TYPE_MAP,
} from '../../../shaders/trackSurface'
import { usePhysics } from '../../../wasm'

// Helper to compute shader weather type from dynamic conditions
function computeWeatherType(temperature: number, rainIntensity: number): number {
  if (rainIntensity > 0.3) return WEATHER_TYPE_MAP.rain
  if (temperature < 5) return WEATHER_TYPE_MAP.cold
  if (temperature > 35) return WEATHER_TYPE_MAP.hot
  return WEATHER_TYPE_MAP.dry
}

export default function TrackTemperatureOverlay() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const dataTexture = useTrackTemperatureStore(s => s.dataTexture)
  const textureNeedsUpdate = useTrackTemperatureStore(s => s.textureNeedsUpdate)
  const initializeTexture = useTrackTemperatureStore(s => s.initializeTexture)
  const updateTexture = useTrackTemperatureStore(s => s.updateTexture)
  const updateWeatherEffects = useTrackTemperatureStore(s => s.updateWeatherEffects)

  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)
  const isHeatmapVisible = useHeatmapStore(s => s.isVisible)

  const physics = usePhysics()

  // Initialize texture on mount
  useEffect(() => {
    initializeTexture()
  }, [initializeTexture])

  // Initialize WASM track temperature grid with matching bounds
  useEffect(() => {
    if (physics.initialized) {
      physics.initTrackTemperature(TRACK_TEMP_CONFIG.gridSize, {
        min_x: TRACK_TEMP_CONFIG.worldBounds.minX,
        max_x: TRACK_TEMP_CONFIG.worldBounds.maxX,
        min_z: TRACK_TEMP_CONFIG.worldBounds.minZ,
        max_z: TRACK_TEMP_CONFIG.worldBounds.maxZ,
      })
    }
  }, [physics, physics.initialized])

  // Create shader uniforms
  const uniforms = useMemo(
    () => ({
      temperatureMap: { value: null as THREE.DataTexture | null },
      worldBoundsMin: {
        value: new THREE.Vector2(
          TRACK_TEMP_CONFIG.worldBounds.minX,
          TRACK_TEMP_CONFIG.worldBounds.minZ,
        ),
      },
      worldBoundsMax: {
        value: new THREE.Vector2(
          TRACK_TEMP_CONFIG.worldBounds.maxX,
          TRACK_TEMP_CONFIG.worldBounds.maxZ,
        ),
      },
      weatherType: { value: WEATHER_TYPE_MAP.dry },
      ambientTemp: { value: 0.643 }, // ~25C default
      ambientHumidity: { value: 0.3 },
      heatmapVisible: { value: false },
    }),
    [],
  )

  // Update shader uniforms each frame
  useFrame((_, delta) => {
    // Update weather effects (temperature decay, wetness changes)
    updateWeatherEffects(temperature, rainIntensity, delta)

    // Update texture if needed
    if (textureNeedsUpdate) {
      updateTexture()
    }

    // Merge rubber data from WASM into the texture's B channel
    if (dataTexture && physics.initialized) {
      try {
        const wasmData = physics.getTrackTextureData()
        const textureData = dataTexture.image.data as Uint8Array
        const len = Math.min(wasmData.length, textureData.length)

        // Copy only the B channel (rubber + ice) from WASM data
        // WASM texture: R=heat, G=wetness, B=rubber|ice, A=255
        for (let i = 0; i < len; i += 4) {
          textureData[i + 2] = wasmData[i + 2] // B channel: rubber (lower 4 bits) + ice (upper 4 bits)
        }
        dataTexture.needsUpdate = true
      } catch {
        // WASM not ready yet
      }
    }

    // Update shader uniforms
    if (materialRef.current) {
      materialRef.current.uniforms.temperatureMap.value = dataTexture
      materialRef.current.uniforms.weatherType.value = computeWeatherType(
        temperature,
        rainIntensity,
      )
      materialRef.current.uniforms.heatmapVisible.value = isHeatmapVisible

      // Get ambient conditions from WASM physics if initialized
      if (physics.initialized) {
        try {
          const ambient = physics.getAmbientConditions()
          if (ambient) {
            materialRef.current.uniforms.ambientTemp.value = ambient.temperature
            materialRef.current.uniforms.ambientHumidity.value = ambient.humidity
          }
        } catch {
          // Physics not ready yet, use defaults
        }
      }
    }
  })

  // Calculate overlay size from world bounds
  const overlayWidth = TRACK_TEMP_CONFIG.worldBounds.maxX - TRACK_TEMP_CONFIG.worldBounds.minX
  const overlayHeight = TRACK_TEMP_CONFIG.worldBounds.maxZ - TRACK_TEMP_CONFIG.worldBounds.minZ

  return (
    <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={999}>
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
