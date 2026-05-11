import { useEffect, useRef } from 'react'
import { useSessionStore } from '../../../stores/useSessionStore'
import { useDevToolsStore } from '../../../stores/useDevToolsStore'

export default function DevToolsSessionLifecycle() {
  const phase = useSessionStore(s => s.phase)
  const prevPhaseRef = useRef(phase)

  useEffect(() => {
    const leftRunning =
      prevPhaseRef.current === 'running' && phase !== 'running' && phase !== 'paused'

    if (leftRunning) {
      useDevToolsStore.getState().reset()
    }

    prevPhaseRef.current = phase
  }, [phase])

  return null
}
