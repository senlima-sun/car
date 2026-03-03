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
import { usePhysicsDebugStore } from './stores/usePhysicsDebugStore'
import { useGameStore } from './stores/useGameStore'
import { FIXED_TIME_STEP } from './constants/physics'
import { useGlobalKeys } from './hooks/useGlobalKeys'

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

export default function App() {
  const physicsDebug = usePhysicsDebugStore(s => s.enabled)
  const showFPS = useGameStore(s => s.showFPS)
  const physicsPaused = usePhysicsPause()
  useGlobalKeys()

  return (
    <PhysicsProvider fallback={<LoadingFallback />}>
      <KeyboardControls map={keyboardMap}>
        <div className='w-full h-full relative'>
          <Canvas
            shadows
            frameloop='always'
            camera={{ position: [0, 5, 10], fov: 75 }}
            dpr={[1, 1.5]}
            gl={{ logarithmicDepthBuffer: true, toneMapping: THREE.ACESFilmicToneMapping }}
          >
            {showFPS && <FPSMonitor />}
            <Suspense fallback={null}>
              <Physics
                gravity={[0, -9.81, 0]}
                timeStep={FIXED_TIME_STEP}
                debug={physicsDebug}
                paused={physicsPaused}
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
