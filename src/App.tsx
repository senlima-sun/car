import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls } from '@react-three/drei'
import Scene from './components/canvas/Scene'
import HUD from './components/ui/HUD/HUD'
import { PhysicsProvider } from './wasm'

// Define control keys
const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'brake', keys: ['Space'] },
  { name: 'handbrake', keys: ['ShiftLeft', 'ShiftRight'] },
  { name: 'drs', keys: ['KeyE'] },
  { name: 'camera', keys: ['KeyC'] },
  { name: 'heatmap', keys: ['KeyH'] },
  { name: 'distanceGrid', keys: ['AltLeft', 'AltRight'] },
  { name: 'freeCamera', keys: ['KeyF'] },
]

function LoadingFallback() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a2e',
      color: '#eee',
      fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', marginBottom: '10px' }}>Loading Physics Engine...</div>
        <div style={{ fontSize: '14px', opacity: 0.7 }}>Initializing WASM module</div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <PhysicsProvider fallback={<LoadingFallback />}>
      <KeyboardControls map={keyboardMap}>
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <Canvas
            shadows
            camera={{ position: [0, 5, 10], fov: 75 }}
            style={{ background: '#87CEEB' }}
          >
            <Suspense fallback={null}>
              <Physics gravity={[0, -9.81, 0]}>
                <Scene />
              </Physics>
            </Suspense>
          </Canvas>
          {/* HUD overlay (outside Canvas) */}
          <HUD />
        </div>
      </KeyboardControls>
    </PhysicsProvider>
  )
}
