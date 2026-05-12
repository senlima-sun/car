import { Suspense, useState, useEffect, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls } from '@react-three/drei'

import * as THREE from 'three'
import Scene from './components/canvas/Scene'
import FPSMonitor from './components/canvas/FPSMonitor'
import HUD from './components/ui/HUD/HUD'
import LoadingFallback from './components/ui/LoadingFallback'
import { PhysicsProvider } from './wasm'
import { keyboardMap } from './constants/controls'
import { useDevToolsStore } from './stores/useDevToolsStore'
import { isSessionShellStatus, useGameStore } from './stores/useGameStore'
import { isRunningSessionPhase, useSessionStore } from './stores/useSessionStore'
import { useTrackStore } from './stores/useTrackStore'
import { FIXED_TIME_STEP } from './constants/physics'
import { useGlobalKeys } from './hooks/useGlobalKeys'
import { PRESET_TRACKS } from './constants/tracks'

function usePhysicsPause() {
  const [paused, setPaused] = useState(false)
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        setPaused(true)
        clearTimeout(resumeTimer.current)
      } else {
        resumeTimer.current = setTimeout(() => setPaused(false), 50)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      clearTimeout(resumeTimer.current)
    }
  }, [])

  return paused
}

function useUrlTrackParam() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const requestedTrackId = params.get('track')
    if (!requestedTrackId) return
    const preset = PRESET_TRACKS.find(t => t.id === requestedTrackId)
    if (!preset) return
    useTrackStore.getState().loadPresetTrack(requestedTrackId)
  }, [])
}

export default function App() {
  const physicsDebug = useDevToolsStore(s => s.panels['physics-debug'].isOpen)
  const showFPS = useGameStore(s => s.showFPS)
  const shellStatus = useGameStore(s => s.status)
  const sessionPhase = useSessionStore(s => s.phase)
  const physicsPaused = usePhysicsPause()
  useGlobalKeys()
  useUrlTrackParam()

  const shouldPausePhysics =
    physicsPaused || !isSessionShellStatus(shellStatus) || !isRunningSessionPhase(sessionPhase)

  return (
    <PhysicsProvider fallback={<LoadingFallback />}>
      <KeyboardControls map={keyboardMap}>
        <div className='w-full h-full relative'>
          <Canvas
            shadows
            frameloop='always'
            camera={{ position: [0, 5, 10], fov: 75 }}
            dpr={[1, 2]}
            gl={{ toneMapping: THREE.ACESFilmicToneMapping, powerPreference: 'high-performance' }}
          >
            {showFPS && <FPSMonitor />}
            <Suspense fallback={null}>
              <Physics
                gravity={[0, -9.81, 0]}
                timeStep={FIXED_TIME_STEP}
                debug={physicsDebug}
                paused={shouldPausePhysics}
              >
                <Scene />
              </Physics>
            </Suspense>
          </Canvas>
          <HUD />
        </div>
      </KeyboardControls>
    </PhysicsProvider>
  )
}
