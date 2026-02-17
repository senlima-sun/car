import { useMemo } from 'react'
import { Clouds, Cloud } from '@react-three/drei'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'
import { usePerformanceStore, type QualityTier } from '../../../stores/usePerformanceStore'

const CLOUD_COUNT_MULT: Record<QualityTier, number> = {
  ultra: 1.0,
  high: 0.7,
  medium: 0.4,
  low: 0.2,
}

const CLOUD_SEGMENTS: Record<QualityTier, number> = {
  ultra: 8,
  high: 8,
  medium: 4,
  low: 2,
}

interface CloudPreset {
  color: string
  height: number
  opacity: number
}

function getCloudPreset(temperature: number, rainIntensity: number): CloudPreset {
  if (rainIntensity > 0.3) {
    return { color: '#3a4550', height: 40, opacity: 0.8 }
  }
  if (temperature > 35) {
    return { color: '#f0e8d8', height: 100, opacity: 0.2 }
  }
  if (temperature < 0) {
    return { color: '#b0b8c0', height: 50, opacity: 0.5 }
  }
  return { color: '#ffffff', height: 80, opacity: 0.3 }
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

export default function CloudLayer() {
  const cloudCover = useEnvironmentStore(s => s.cloudCover)
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)
  const tier = usePerformanceStore(s => s.tier)

  const { preset, cloudCount, positions, segments } = useMemo(() => {
    const preset = getCloudPreset(temperature, rainIntensity)
    const baseCount = Math.floor(cloudCover * 12) + 2
    const cloudCount = Math.max(1, Math.floor(baseCount * CLOUD_COUNT_MULT[tier]))
    const segments = CLOUD_SEGMENTS[tier]
    const radius = 200
    const positions: [number, number, number][] = []

    for (let i = 0; i < cloudCount; i++) {
      const angle = (i / cloudCount) * Math.PI * 2
      const r = radius * (0.6 + seededRandom(i + 1) * 0.4)
      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r
      const y = preset.height + (seededRandom(i + 100) - 0.5) * 20
      positions.push([x, y, z])
    }

    return { preset, cloudCount, positions, segments }
  }, [cloudCover, temperature, rainIntensity, tier])

  if (cloudCount <= 0) return null

  return (
    <Clouds limit={positions.length * 8}>
      {positions.map((pos, i) => (
        <Cloud
          key={i}
          position={pos}
          opacity={preset.opacity}
          speed={0.2}
          bounds={[30, 8, 8]}
          segments={segments}
          color={preset.color}
        />
      ))}
    </Clouds>
  )
}
