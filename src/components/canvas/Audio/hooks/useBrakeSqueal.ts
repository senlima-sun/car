import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Howl } from 'howler'
import { useCarStore } from '@/stores/useCarStore'
import { useAudioStore } from '@/stores/useAudioStore'
import { useGameStore } from '@/stores/useGameStore'
import { createHowl } from '../utils/audioLoader'

const BRAKE_SQUEAL_SRC = '/audio/effects/brake_squeal.mp3'
const UPDATE_INTERVAL = 1 / 30
const LONG_G_THRESHOLD = -1.0
const MIN_SPEED_KMH = 30

export function useBrakeSqueal() {
  const howlRef = useRef<Howl | null>(null)
  const playIdRef = useRef<number | null>(null)
  const elapsed = useRef(0)

  useEffect(() => {
    howlRef.current = createHowl({ src: BRAKE_SQUEAL_SRC, loop: true, volume: 0 })
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

    const { longitudinalG, speed } = useCarStore.getState()

    if (longitudinalG < LONG_G_THRESHOLD && speed > MIN_SPEED_KMH) {
      if (playIdRef.current === null) {
        playIdRef.current = howl.play()
      }
      const intensity = Math.min(1, (Math.abs(longitudinalG) - 1) / 3)
      howl.volume(intensity * masterVolume * effectsVolume)
    } else {
      if (playIdRef.current !== null) {
        howl.volume(0)
      }
    }
  })
}
