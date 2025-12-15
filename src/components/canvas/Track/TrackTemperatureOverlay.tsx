import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  useTrackTemperatureStore,
  TRACK_TEMP_CONFIG,
} from '../../../stores/useTrackTemperatureStore'
import { useWeatherStore } from '../../../stores/useWeatherStore'
import {
  trackSurfaceVertexShader,
  trackSurfaceFragmentShader,
  WEATHER_TYPE_MAP,
} from '../../../shaders/trackSurface'

export default function TrackTemperatureOverlay() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const dataTexture = useTrackTemperatureStore(s => s.dataTexture)
  const textureNeedsUpdate = useTrackTemperatureStore(s => s.textureNeedsUpdate)
  const initializeTexture = useTrackTemperatureStore(s => s.initializeTexture)
  const updateTexture = useTrackTemperatureStore(s => s.updateTexture)
  const updateWeatherEffects = useTrackTemperatureStore(s => s.updateWeatherEffects)

  const currentWeather = useWeatherStore(s => s.currentWeather)

  // Initialize texture on mount
  useEffect(() => {
    initializeTexture()
  }, [initializeTexture])

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
    }),
    [],
  )

  // Update shader uniforms each frame
  useFrame((_, delta) => {
    // Update weather effects (temperature decay, wetness changes)
    updateWeatherEffects(currentWeather, delta)

    // Update texture if needed
    if (textureNeedsUpdate) {
      updateTexture()
    }

    // Update shader uniforms
    if (materialRef.current) {
      materialRef.current.uniforms.temperatureMap.value = dataTexture
      materialRef.current.uniforms.weatherType.value = WEATHER_TYPE_MAP[currentWeather]
    }
  })

  // Calculate overlay size from world bounds
  const overlayWidth = TRACK_TEMP_CONFIG.worldBounds.maxX - TRACK_TEMP_CONFIG.worldBounds.minX
  const overlayHeight = TRACK_TEMP_CONFIG.worldBounds.maxZ - TRACK_TEMP_CONFIG.worldBounds.minZ

  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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
