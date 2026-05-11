import { useEffect, useRef } from 'react'
import { useSessionStore } from '../../../stores/useSessionStore'
import { useDevToolsStore } from '../../../stores/useDevToolsStore'

export default function DevToolsSessionLifecycle() {
  const phase = useSessionStore(s => s.phase)
  const config = useSessionStore(s => s.config)
  const prevConfigRef = useRef(config)
  const prevPhaseRef = useRef(phase)

  useEffect(() => {
    const phaseChanged = prevPhaseRef.current !== phase
    const configChanged = prevConfigRef.current !== config
    const leftRunning =
      phaseChanged &&
      prevPhaseRef.current === 'running' &&
      phase !== 'running' &&
      phase !== 'paused'

    if (configChanged || leftRunning) {
      useDevToolsStore.getState().reset()
    }

    prevPhaseRef.current = phase
    prevConfigRef.current = config
  }, [phase, config])

  return null
}
