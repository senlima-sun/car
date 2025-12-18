import { useMemo } from 'react'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { lerp, computeAtmosphereFromDynamic } from './DynamicSky'

// Color interpolation helper
function lerpColor(from: string, to: string, t: number): string {
  // Parse hex colors
  const fromR = parseInt(from.slice(1, 3), 16)
  const fromG = parseInt(from.slice(3, 5), 16)
  const fromB = parseInt(from.slice(5, 7), 16)

  const toR = parseInt(to.slice(1, 3), 16)
  const toG = parseInt(to.slice(3, 5), 16)
  const toB = parseInt(to.slice(5, 7), 16)

  const r = Math.round(lerp(fromR, toR, t))
  const g = Math.round(lerp(fromG, toG, t))
  const b = Math.round(lerp(fromB, toB, t))

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export default function DynamicLighting() {
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)

  const config = useMemo(() => {
    return computeAtmosphereFromDynamic(temperature, rainIntensity)
  }, [temperature, rainIntensity])

  return (
    <>
      {/* Ambient light */}
      <ambientLight intensity={config.ambientIntensity} />

      {/* Main sun light */}
      <directionalLight
        position={config.sunPosition}
        intensity={config.sunIntensity}
        color={config.sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />

      {/* Fill light from opposite side */}
      <directionalLight
        position={[-30, 40, -20]}
        intensity={config.fillLightIntensity}
        color={config.fillLightColor}
      />

      {/* Hemisphere light for natural sky/ground lighting */}
      <hemisphereLight
        args={[config.hemisphereSkyColor, config.hemisphereGroundColor, config.hemisphereIntensity]}
      />

      {/* Front fill light to illuminate car face - scales with ambient */}
      <pointLight
        position={[0, 10, 30]}
        intensity={50 * config.ambientIntensity}
        distance={60}
        color='#ffffff'
      />
    </>
  )
}

export { lerpColor }
