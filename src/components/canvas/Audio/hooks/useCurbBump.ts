import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Howl } from 'howler'
import { useAudioStore } from '@/stores/useAudioStore'
import { useGameStore } from '@/stores/useGameStore'
import { useSurfaceStore } from '@/stores/useSurfaceStore'
import { createHowl } from '../utils/audioLoader'

const CURB_BUMP_SRC = '/audio/effects/curb_bump.mp3'
const DEBOUNCE_MS = 300

export function useCurbBump() {
  const howlRef = useRef<Howl | null>(null)
  const prevOnCurb = useRef(false)
  const lastPlayTime = useRef(0)

  useEffect(() => {
    howlRef.current = createHowl({ src: CURB_BUMP_SRC, loop: false, volume: 0 })
    return () => {
      if (howlRef.current) {
        howlRef.current.stop()
        howlRef.current.unload()
      }
    }
  }, [])

  useFrame(() => {
    const howl = howlRef.current
    if (!howl || howl.state() !== 'loaded') return

    const { isUnlocked, isMuted, masterVolume, effectsVolume } = useAudioStore.getState()
    const status = useGameStore.getState().status

    if (!isUnlocked || isMuted || status !== 'racing') {
      prevOnCurb.current = false
      return
    }

    const onCurb = useSurfaceStore.getState().currentSurface === 'curb'
    const now = performance.now()

    if (onCurb && !prevOnCurb.current && now - lastPlayTime.current > DEBOUNCE_MS) {
      howl.volume(masterVolume * effectsVolume)
      howl.play()
      lastPlayTime.current = now
    }

    prevOnCurb.current = onCurb
  })
}
