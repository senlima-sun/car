import { Suspense, lazy, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls } from '@react-three/drei'

import Scene from './components/canvas/Scene'
import HUD from './components/ui/HUD/HUD'
import LoadingFallback from './components/ui/LoadingFallback'
import { PhysicsProvider } from './wasm'
import { keyboardMap } from './constants/controls'
import { usePhysicsDebugStore } from './stores/usePhysicsDebugStore'

const CarViewer = lazy(() => import('./components/car-viewer/CarViewer'))

type AppView = 'game' | 'viewer'

function GameApp({ onSwitchView }: { onSwitchView: (view: AppView) => void }) {
  const physicsDebug = usePhysicsDebugStore(s => s.enabled)
  return (
    <PhysicsProvider fallback={<LoadingFallback />}>
      <KeyboardControls map={keyboardMap}>
        <div className='w-full h-full relative'>
          <Canvas shadows camera={{ position: [0, 5, 10], fov: 75 }} dpr={[1, 2]} gl={{ logarithmicDepthBuffer: true }}>
            <Suspense fallback={null}>
              <Physics gravity={[0, -9.81, 0]} debug={physicsDebug}>
                <Scene />
              </Physics>
            </Suspense>
          </Canvas>
          <HUD />
          <button
            onClick={() => onSwitchView('viewer')}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#ccc',
              padding: '6px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              zIndex: 50,
            }}
          >
            Car Viewer
          </button>
        </div>
      </KeyboardControls>
    </PhysicsProvider>
  )
}

export default function App() {
  const [view, setView] = useState<AppView>('game')

  if (view === 'viewer') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <CarViewer onBack={() => setView('game')} />
      </Suspense>
    )
  }

  return <GameApp onSwitchView={setView} />
}
