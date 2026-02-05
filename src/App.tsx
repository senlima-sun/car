import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls } from '@react-three/drei'

import Scene from './components/canvas/Scene'
import HUD from './components/ui/HUD/HUD'
import LoadingFallback from './components/ui/LoadingFallback'
import { PhysicsProvider } from './wasm'
import { AudioProvider } from './audio/AudioContext'
import { useAudioSystem } from './audio/useAudioSystem'
import { keyboardMap } from './constants/controls'

function AudioSystemInitializer() {
  useAudioSystem()
  return null
}

export default function App() {
  return (
    <PhysicsProvider fallback={<LoadingFallback />}>
      <AudioProvider>
        <KeyboardControls map={keyboardMap}>
          <AudioSystemInitializer />
          <div className='w-full h-full relative'>
            <Canvas shadows camera={{ position: [0, 5, 10], fov: 75 }} className='bg-sky-300'>
              <Suspense fallback={null}>
                <Physics gravity={[0, -9.81, 0]}>
                  <Scene />
                </Physics>
              </Suspense>
            </Canvas>
            <HUD />
          </div>
        </KeyboardControls>
      </AudioProvider>
    </PhysicsProvider>
  )
}
