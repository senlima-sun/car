import { useCallback } from 'react'
import { useCarStore } from '@/stores/useCarStore'
import { useAudioContext } from './hooks/useAudioContext'
import { useEngineSound } from './hooks/useEngineSound'
import { useTireScreech } from './hooks/useTireScreech'
import { useWindNoise } from './hooks/useWindNoise'
import { useRainSound } from './hooks/useRainSound'
import { useBrakeSqueal } from './hooks/useBrakeSqueal'
import { useGrassRumble } from './hooks/useGrassRumble'
import { useCurbBump } from './hooks/useCurbBump'
import { useGravelCrunch } from './hooks/useGravelCrunch'

export default function CarAudio() {
  useAudioContext()
  useEngineSound()

  const getSkidIntensity = useCallback(() => {
    const { speed, steerAngle, lateralG, skidIntensity } = useCarStore.getState()
    if (speed < 5) return 0
    return Math.max(
      Math.abs(steerAngle) * speed * 0.01,
      Math.abs(lateralG) / 3,
      skidIntensity,
    )
  }, [])

  useTireScreech({ getSkidIntensity })
  useWindNoise()
  useRainSound()
  useBrakeSqueal()
  useGrassRumble()
  useCurbBump()
  useGravelCrunch()

  return null
}
