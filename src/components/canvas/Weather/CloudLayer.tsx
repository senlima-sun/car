import { useMemo } from 'react'
import { Cloud } from '@react-three/drei'
import { useEnvironmentStore } from '../../../stores/useEnvironmentStore'

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

  const { preset, cloudCount, positions } = useMemo(() => {
    const preset = getCloudPreset(temperature, rainIntensity)
    const cloudCount = Math.floor(cloudCover * 12) + 2
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

    return { preset, cloudCount, positions }
  }, [cloudCover, temperature, rainIntensity])

  if (cloudCount <= 0) return null

  return (
    <group>
      {positions.map((pos, i) => (
        <Cloud
          key={i}
          position={pos}
          opacity={preset.opacity}
          speed={0.2}
          bounds={[30, 8, 8]}
          segments={8}
          color={preset.color}
        />
      ))}
    </group>
  )
}
