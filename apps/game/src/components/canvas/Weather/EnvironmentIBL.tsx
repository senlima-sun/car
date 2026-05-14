import { useState, useEffect, useRef } from 'react'
import { Environment, useEnvironment } from '@react-three/drei'
import { usePerformanceStore } from '@/stores/usePerformanceStore'

const HDRI_PATH = '/textures/hdri/'
const IBL_FILE = 'ibl_clear_2K.exr'

useEnvironment.preload({ files: IBL_FILE, path: HDRI_PATH })

const KEEP_ENABLED_MIN_FPS = 75
const REENABLE_MIN_FPS = 95

export default function EnvironmentIBL() {
  const tex = useEnvironment({ files: IBL_FILE, path: HDRI_PATH })
  const avgFps = usePerformanceStore(s => s.avgFps)
  const [enabled, setEnabled] = useState(true)
  const enabledRef = useRef(true)

  useEffect(() => {
    const next = enabledRef.current ? avgFps >= KEEP_ENABLED_MIN_FPS : avgFps >= REENABLE_MIN_FPS
    if (next !== enabledRef.current) {
      enabledRef.current = next
      setEnabled(next)
    }
  }, [avgFps])

  if (!enabled) return null

  return <Environment map={tex} background={false} environmentIntensity={0.6} />
}
