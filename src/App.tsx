import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls } from '@react-three/drei'

import Scene from './components/canvas/Scene'
import HUD from './components/ui/HUD/HUD'
import LoadingFallback from './components/ui/LoadingFallback'
import { PhysicsProvider } from './wasm'
import { keyboardMap } from './constants/controls'
import { usePhysicsDebugStore } from './stores/usePhysicsDebugStore'

function GameApp() {
  const physicsDebug = usePhysicsDebugStore(s => s.enabled)
  return (
    <PhysicsProvider fallback={<LoadingFallback />}>
      <KeyboardControls map={keyboardMap}>
        <div className='w-full h-full relative'>
          <Canvas shadows camera={{ position: [0, 5, 10], fov: 75 }} gl={{ logarithmicDepthBuffer: true }} className='bg-sky-300'>
            <Suspense fallback={null}>
              <Physics gravity={[0, -9.81, 0]} debug={physicsDebug}>
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

export default function App() {
  return <GameApp />
}
