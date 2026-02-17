import { useEffect, useState } from 'react'
import { useAquaplaningStore } from '../../../stores/useAquaplaningStore'

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  warning: {
    background: 'rgba(200, 50, 50, 0.85)',
    borderRadius: 12,
    padding: '20px 40px',
    textAlign: 'center',
    border: '3px solid #ff4444',
    boxShadow: '0 0 30px rgba(255, 0, 0, 0.6)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase' as const,
    letterSpacing: 4,
    marginBottom: 8,
    textShadow: '0 0 10px rgba(255, 255, 255, 0.8)',
  },
  subtitle: {
    fontSize: 14,
    color: '#ffcccc',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
  },
  wheels: {
    display: 'flex',
    justifyContent: 'center',
    gap: 10,
    marginTop: 12,
  },
  wheel: {
    width: 24,
    height: 24,
    borderRadius: 4,
    border: '2px solid #ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  thermalShock: {
    background: 'rgba(100, 100, 200, 0.85)',
    borderRadius: 12,
    padding: '15px 30px',
    textAlign: 'center',
    border: '3px solid #6666ff',
    boxShadow: '0 0 20px rgba(100, 100, 255, 0.5)',
    marginTop: 20,
  },
  shockTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
  },
  shockInfo: {
    fontSize: 12,
    color: '#ccccff',
    marginTop: 4,
  },
}

export default function AquaplaningIndicator() {
  const isAquaplaning = useAquaplaningStore(s => s.isAquaplaning)
  const isThermalShock = useAquaplaningStore(s => s.isThermalShock)
  const thermalShockPenalty = useAquaplaningStore(s => s.thermalShockPenalty)
  const thermalShockRecoveryTime = useAquaplaningStore(s => s.thermalShockRecoveryTime)

  // Pulsing animation state
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    if (!isAquaplaning && !isThermalShock) {
      setPulse(0)
      return
    }

    const interval = setInterval(() => {
      setPulse(p => (p + 1) % 100)
    }, 30)

    return () => clearInterval(interval)
  }, [isAquaplaning, isThermalShock])

  // Don't render if nothing to show
  if (!isAquaplaning && !isThermalShock) return null

  // Calculate pulsing opacity
  const pulseOpacity = 0.7 + Math.sin((pulse / 100) * Math.PI * 2) * 0.3

  // Wheel labels
  return (
    <div style={{ ...styles.overlay, opacity: pulseOpacity }}>
      <div>
        {isThermalShock && (
          <div style={styles.thermalShock}>
            <div style={styles.shockTitle}>Tire Thermal Shock</div>
            <div style={styles.shockInfo}>
              Grip -{Math.round(thermalShockPenalty * 100)}% | Recovery:{' '}
              {thermalShockRecoveryTime.toFixed(1)}s
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
