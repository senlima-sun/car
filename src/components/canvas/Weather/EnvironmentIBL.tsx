import { useState, useEffect } from 'react'
import { Environment, useEnvironment } from '@react-three/drei'
import { usePerformanceStore } from '@/stores/usePerformanceStore'

const HDRI_PATH = '/textures/hdri/'
const IBL_FILE = 'ibl_clear_2K.exr'

useEnvironment.preload({ files: IBL_FILE, path: HDRI_PATH })

const ENABLE_FPS = 95
const DISABLE_FPS = 75

export default function EnvironmentIBL() {
  const tex = useEnvironment({ files: IBL_FILE, path: HDRI_PATH })
  const avgFps = usePerformanceStore(s => s.avgFps)
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    setEnabled(curr => {
      if (curr) return avgFps >= DISABLE_FPS
      return avgFps >= ENABLE_FPS
    })
  }, [avgFps])

  if (!enabled) return null

  return <Environment map={tex} background={false} environmentIntensity={0.6} />
}
