import { useEffect, useRef } from 'react'
import { useSessionStore } from '@/stores/useSessionStore'
import { useStartLightsStore } from '@/stores/useStartLightsStore'

export function useStartLightsDriver(): void {
  const phase = useSessionStore(s => s.phase)
  const sessionKind = useSessionStore(s => s.config?.kind ?? null)
  const startSession = useSessionStore(s => s.startSession)
  const prevStatusRef = useRef<string>('idle')

  useEffect(() => {
    const store = useStartLightsStore.getState()
    if (phase === 'countdown' && store.status === 'idle') {
      if (sessionKind === 'race') {
        store.arm('session')
      } else {
        startSession()
      }
      return
    }
    if (phase === 'idle' || phase === 'setup' || phase === 'finished') {
      if (store.status !== 'idle') store.reset()
    }
  }, [phase, sessionKind, startSession])

  useEffect(() => {
    let frame = 0
    const loop = () => {
      const store = useStartLightsStore.getState()
      if (store.status !== 'idle') {
        store.tick(performance.now())
        const justWentToGo = prevStatusRef.current !== 'go' && store.status === 'go'
        if (justWentToGo && store.trigger === 'session') {
          startSession()
        }
        prevStatusRef.current = store.status
      } else {
        prevStatusRef.current = 'idle'
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [startSession])
}
