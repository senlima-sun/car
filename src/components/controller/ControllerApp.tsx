import { useState, useRef, useCallback, useEffect } from 'react'
import { useGyroscope } from './hooks/useGyroscope'
import { useMobileSetup } from './hooks/useMobileSetup'
import { useControllerSync } from './hooks/useControllerSync'
import { CalibrationScreen } from './CalibrationScreen'
import { ControlSurface } from './ControlSurface'
import { ActionButtons } from './ActionButtons'
import type { ControllerState } from '../../utils/webrtc/types'

type Phase = 'permission' | 'connecting' | 'calibrating' | 'controlling' | 'disconnected'

function getUrlParams(): { room: string; signal: string } {
  const params = new URLSearchParams(window.location.search)
  return {
    room: params.get('room') || '',
    signal: params.get('signal') || '',
  }
}

export function ControllerApp() {
  const [phase, setPhase] = useState<Phase>('permission')
  const [latency, setLatency] = useState(0)
  const { room, signal } = getUrlParams()

  const gyro = useGyroscope()
  const { requestFullscreen } = useMobileSetup()

  const throttleRef = useRef(0)
  const brakeRef = useRef(0)
  const handbrakeRef = useRef(false)
  const buttonsRef = useRef({ ers: false, aero: false, camera: false })
  const gyroRef = useRef(gyro)
  gyroRef.current = gyro

  const getControllerState = useCallback((): ControllerState => ({
    steer: gyroRef.current.steer,
    throttle: throttleRef.current,
    brake: brakeRef.current,
    handbrake: handbrakeRef.current,
    buttons: { ...buttonsRef.current },
  }), [])

  useControllerSync({
    signalingUrl: signal,
    roomId: room,
    getState: getControllerState,
    onConnected: () => {
      if (gyroRef.current.isCalibrated) setPhase('controlling')
      else setPhase('calibrating')
    },
    onDisconnected: () => setPhase('disconnected'),
    onLatency: setLatency,
  })

  const handlePermissionGrant = useCallback(async () => {
    requestFullscreen()
    const ok = await gyro.requestPermissionAndStart()
    if (ok) setPhase('connecting')
  }, [gyro.requestPermissionAndStart, requestFullscreen])

  useEffect(() => {
    if (!gyro.needsPermission) {
      gyro.requestPermissionAndStart()
      setPhase('connecting')
    }
  }, [])

  if (!room || !signal) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">
        <div className="text-center p-8">
          <h1 className="text-2xl font-medium mb-4">Missing Connection Info</h1>
          <p className="text-neutral-400">Scan the QR code from the game to connect.</p>
        </div>
      </div>
    )
  }

  if (phase === 'permission') {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">
        <div className="text-center p-8 space-y-6">
          <h1 className="text-2xl font-medium">Phone Controller</h1>
          <p className="text-neutral-400">This app uses your phone as a steering wheel.</p>
          <button
            className="bg-blue-600 active:bg-blue-400 text-white px-8 py-4 rounded-lg text-lg font-medium"
            onClick={handlePermissionGrant}
          >
            Enable Motion Sensors
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'connecting') {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">
        <div className="text-center p-8 space-y-4">
          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse mx-auto" />
          <p className="text-neutral-400">Connecting to game...</p>
          <p className="text-neutral-600 text-sm font-mono">Room: {room}</p>
        </div>
      </div>
    )
  }

  if (phase === 'disconnected') {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">
        <div className="text-center p-8 space-y-4">
          <div className="w-3 h-3 bg-red-400 rounded-full mx-auto" />
          <p className="text-neutral-400">Connection lost. Reconnecting...</p>
        </div>
      </div>
    )
  }

  if (phase === 'calibrating') {
    return (
      <CalibrationScreen
        currentGamma={gyro.rawGamma}
        steerPreview={gyro.steer}
        onCalibrate={gyro.calibrate}
        onComplete={() => setPhase('controlling')}
      />
    )
  }

  return (
    <div className="h-screen w-screen bg-neutral-950 relative overflow-hidden select-none" style={{ touchAction: 'manipulation' }}>
      <ControlSurface
        onThrottleChange={v => { throttleRef.current = v }}
        onBrakeChange={v => { brakeRef.current = v }}
      />
      <ActionButtons
        onHandbrake={active => { handbrakeRef.current = active }}
        onErs={() => { buttonsRef.current = { ...buttonsRef.current, ers: !buttonsRef.current.ers } }}
        onAero={() => { buttonsRef.current = { ...buttonsRef.current, aero: !buttonsRef.current.aero } }}
        onCamera={() => { buttonsRef.current = { ...buttonsRef.current, camera: !buttonsRef.current.camera } }}
      />
      <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 rounded-full px-3 py-1">
        <span className="w-2 h-2 bg-green-400 rounded-full" />
        <span className="text-white text-xs font-mono">{latency}ms</span>
      </div>
    </div>
  )
}
