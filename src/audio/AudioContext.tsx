import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { AudioManager } from './AudioManager'
import { useAudioStore } from '@/stores/useAudioStore'

const AudioManagerContext = createContext<AudioManager | null>(null)

export function useAudioContext(): AudioManager {
  const ctx = useContext(AudioManagerContext)
  if (!ctx) {
    throw new Error('useAudioContext must be used within an AudioProvider')
  }
  return ctx
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const managerRef = useRef<AudioManager>(AudioManager.getInstance())
  const initAttemptedRef = useRef(false)

  useEffect(() => {
    const handleInteraction = async () => {
      if (initAttemptedRef.current) return
      initAttemptedRef.current = true

      const manager = managerRef.current
      await manager.init()
      useAudioStore.getState().setInitialized()

      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }

    window.addEventListener('click', handleInteraction)
    window.addEventListener('keydown', handleInteraction)
    window.addEventListener('touchstart', handleInteraction)

    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('keydown', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = useAudioStore.subscribe(state => {
      managerRef.current.updateVolumeConfig({
        master: state.master,
        engine: state.engine,
        effects: state.effects,
        ui: state.ui,
        music: state.music,
        muted: state.muted,
      })
    })

    const state = useAudioStore.getState()
    managerRef.current.updateVolumeConfig({
      master: state.master,
      engine: state.engine,
      effects: state.effects,
      ui: state.ui,
      music: state.music,
      muted: state.muted,
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    return () => {
      AudioManager.destroyInstance()
    }
  }, [])

  return (
    <AudioManagerContext.Provider value={managerRef.current}>
      {children}
    </AudioManagerContext.Provider>
  )
}
