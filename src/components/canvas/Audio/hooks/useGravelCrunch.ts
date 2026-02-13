import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Howl } from 'howler'
import { useCarStore } from '@/stores/useCarStore'
import { useAudioStore } from '@/stores/useAudioStore'
import { useGameStore } from '@/stores/useGameStore'
import { useSurfaceStore } from '@/stores/useSurfaceStore'
import { createHowl } from '../utils/audioLoader'

const GRAVEL_CRUNCH_SRC = '/audio/effects/gravel_crunch.mp3'
const UPDATE_INTERVAL = 1 / 30
const MIN_SPEED_KMH = 5

export function useGravelCrunch() {
  const howlRef = useRef<Howl | null>(null)
  const playIdRef = useRef<number | null>(null)
  const elapsed = useRef(0)

  useEffect(() => {
    howlRef.current = createHowl({ src: GRAVEL_CRUNCH_SRC, loop: true, volume: 0 })
    return () => {
      if (howlRef.current) {
        howlRef.current.stop()
        howlRef.current.unload()
      }
      playIdRef.current = null
    }
  }, [])

  useFrame((_, delta) => {
    elapsed.current += delta
    if (elapsed.current < UPDATE_INTERVAL) return
    elapsed.current = 0

    const howl = howlRef.current
    if (!howl || howl.state() !== 'loaded') return

    const { isUnlocked, isMuted, masterVolume, effectsVolume } = useAudioStore.getState()
    const status = useGameStore.getState().status

    if (!isUnlocked || isMuted || status !== 'racing') {
      if (playIdRef.current !== null) howl.volume(0)
      return
    }

    const surface = useSurfaceStore.getState().currentSurface
    const speed = useCarStore.getState().speed

    if (surface === 'gravel' && speed > MIN_SPEED_KMH) {
      if (playIdRef.current === null) {
        playIdRef.current = howl.play()
      }
      const vol = Math.min(1, speed / 150) * masterVolume * effectsVolume
      howl.volume(vol)
    } else {
      if (playIdRef.current !== null) {
        howl.volume(0)
      }
    }
  })
}
