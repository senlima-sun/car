import { Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { KeyboardControls } from '@react-three/drei'
import Scene from './components/canvas/Scene'
import HUD from './components/ui/HUD/HUD'
import { useGameStore } from './stores/useGameStore'
import { useWeatherStore } from './stores/useWeatherStore'
import { usePitStore } from './stores/usePitStore'
import { useLapTimeStore } from './stores/useLapTimeStore'
import { useMobileDetection } from './utils/isMobile'

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
]

function ModeToggleHandler() {
  const toggleCustomizeMode = useGameStore(s => s.toggleCustomizeMode)
  const isMobile = useMobileDetection()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable customize mode toggle on mobile
      if (e.code === 'KeyT' && !isMobile) {
        toggleCustomizeMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleCustomizeMode, isMobile])

  return null
}

function WeatherHandler() {
  const cycleWeather = useWeatherStore(s => s.cycleWeather)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyQ') {
        cycleWeather()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cycleWeather])

  return null
}

function PitStopHandler() {
  const isInPitBox = usePitStore(s => s.isInPitBox)
  const isPitStopActive = usePitStore(s => s.isPitStopActive)
  const startPitStop = usePitStore(s => s.startPitStop)
  const cancelPitStop = usePitStore(s => s.cancelPitStop)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // P key to open pit stop menu when in pit box
      if (e.code === 'KeyP' && isInPitBox && !isPitStopActive) {
        startPitStop()
      }
      // Escape key to cancel pit stop
      if (e.code === 'Escape' && isPitStopActive) {
        cancelPitStop()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isInPitBox, isPitStopActive, startPitStop, cancelPitStop])

  return null
}

function LapTimeHandler() {
  const toggleRecording = useLapTimeStore(s => s.toggleRecording)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        toggleRecording()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleRecording])

  return null
}

export default function App() {
  return (
    <KeyboardControls map={keyboardMap}>
      <ModeToggleHandler />
      <WeatherHandler />
      <PitStopHandler />
      <LapTimeHandler />
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Canvas
          shadows
          camera={{ position: [0, 5, 10], fov: 75 }}
          style={{ background: '#b5d3e7' }}
        >
          <Suspense fallback={null}>
            <Physics gravity={[0, -9.81, 0]}>
              <Scene />
            </Physics>
          </Suspense>
        </Canvas>
        <HUD />
      </div>
    </KeyboardControls>
  )
}
