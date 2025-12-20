import { useErsStore } from '../../../stores/useErsStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 11,
    minWidth: 100,
  },
  icon: {
    fontSize: 16,
    lineHeight: '16px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    textTransform: 'uppercase' as const,
  },
  value: {
    fontWeight: 'bold',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  presetBadge: {
    background: 'rgba(168, 85, 247, 0.3)',
    color: '#a855f7',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    textTransform: 'uppercase' as const,
  },
  criticalOverlay: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'rgba(239, 68, 68, 0.9)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center' as const,
    zIndex: 1000,
    pointerEvents: 'none' as const,
  },
}

function getPresetAbbrev(preset: string): string {
  switch (preset) {
    case 'Aggressive':
      return 'AGG'
    case 'Balanced':
      return 'BAL'
    case 'Conservative':
      return 'CON'
    default:
      return 'BAL'
  }
}

export default function CoastIndicator() {
  const mode = useErsStore((state) => state.mode)
  const semiAuto = useErsStore((state) => state.semiAuto)
  const semiAutoConfig = useErsStore((state) => state.semiAutoConfig)
  const coastIndicatorVisible = useErsStore((state) => state.coastIndicatorVisible)

  // Only show when in SemiAuto mode and visibility is enabled
  if (mode !== 'SemiAuto' || !coastIndicatorVisible) {
    return null
  }

  const { coast_recommended, coast_benefit, is_critical, deploy_efficiency } = semiAuto
  const { preset } = semiAutoConfig

  // Calculate display values
  const coastBenefitPercent = Math.round(coast_benefit * 100)
  const efficiencyPercent = Math.round(deploy_efficiency * 100)

  // Determine indicator state
  const isCoastActive = coast_recommended && coast_benefit > 0.1
  const indicatorColor = is_critical ? '#ef4444' : isCoastActive ? '#3b82f6' : '#22c55e'
  const statusText = is_critical ? 'CRITICAL' : isCoastActive ? 'COAST' : 'DEPLOY'
  const statusIcon = is_critical ? '!' : isCoastActive ? '↓' : '↑'

  return (
    <>
      <div
        style={{
          ...styles.container,
          borderLeft: `3px solid ${indicatorColor}`,
          animation: is_critical ? 'criticalPulse 0.5s ease-in-out infinite' : 'none',
        }}
      >
        {/* Status icon */}
        <span style={{ ...styles.icon, color: indicatorColor }}>{statusIcon}</span>

        {/* Main content */}
        <div style={styles.content as React.CSSProperties}>
          <span style={styles.label}>Semi-Auto</span>
          <span style={{ ...styles.value, color: indicatorColor }}>{statusText}</span>
        </div>

        {/* Efficiency or coast benefit */}
        <div style={styles.content as React.CSSProperties}>
          <span style={styles.label}>{isCoastActive ? 'Benefit' : 'Efficiency'}</span>
          <span style={{ ...styles.value, color: indicatorColor }}>
            {isCoastActive ? coastBenefitPercent : efficiencyPercent}%
          </span>
        </div>

        {/* Preset badge */}
        <span style={styles.presetBadge}>{getPresetAbbrev(preset)}</span>
      </div>

      {/* Critical battery warning overlay */}
      {is_critical && (
        <div style={styles.criticalOverlay}>
          CRITICAL BATTERY - HARVESTING ONLY
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes criticalPulse {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 0 rgba(239, 68, 68, 0);
          }
          50% {
            opacity: 0.8;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.6);
          }
        }
      `}</style>
    </>
  )
}
