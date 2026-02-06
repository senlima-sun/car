import { useLapTimeStore } from '../../../stores/useLapTimeStore'

export default function WrongWayIndicator() {
  const wrongWay = useLapTimeStore(state => state.wrongWay)

  if (!wrongWay) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(220, 38, 38, 0.85)',
        color: '#fff',
        padding: '16px 48px',
        borderRadius: 12,
        fontWeight: 'bold',
        fontSize: 28,
        letterSpacing: 4,
        pointerEvents: 'none',
        zIndex: 1000,
        border: '3px solid rgba(255, 255, 255, 0.5)',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
      }}
    >
      WRONG WAY
    </div>
  )
}
