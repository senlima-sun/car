import { useRemoteControlStore } from '../../../stores/useRemoteControlStore'
import { useCarStore } from '../../../stores/useCarStore'

export function SteeringIndicator() {
  const isConnected = useRemoteControlStore(s => s.connectionStatus === 'connected')
  const steerAngle = useCarStore(s => s.steerAngle)
  const steer = steerAngle / 0.3

  if (!isConnected) return null

  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-48">
      <div className="h-2 bg-neutral-800/80 rounded-full relative overflow-hidden">
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-neutral-600" />
        <div
          className="absolute top-0 bottom-0 w-3 rounded-full transition-none"
          style={{
            left: `${50 + steer * 50}%`,
            transform: 'translateX(-50%)',
            background: Math.abs(steer) > 0.8 ? '#ef4444' : Math.abs(steer) > 0.5 ? '#eab308' : '#22c55e',
          }}
        />
      </div>
    </div>
  )
}
