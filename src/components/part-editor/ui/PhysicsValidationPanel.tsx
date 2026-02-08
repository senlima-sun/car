import { useMemo } from 'react'
import { usePartEditorStore } from '../store'
import {
  computeCG,
  computeMass,
  computeFrontalArea,
  estimateDragCoefficient,
  validatePhysics,
  type PhysicsWarning,
} from '../physics/validation'

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
  title: {
    color: '#ccc',
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 0',
    fontSize: '11px',
    borderBottom: '1px solid #3a3a50',
  },
  label: {
    color: '#888',
  },
  value: {
    color: '#ddd',
    fontFamily: 'monospace',
  },
  warning: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    marginTop: '2px',
  },
  partRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '2px 0',
    fontSize: '10px',
    color: '#777',
  },
}

const warningStyles: Record<PhysicsWarning['level'], React.CSSProperties> = {
  info: { background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', borderLeft: '3px solid #3b82f6' },
  warn: { background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', borderLeft: '3px solid #f59e0b' },
  error: { background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderLeft: '3px solid #ef4444' },
}

export default function PhysicsValidationPanel() {
  const parts = usePartEditorStore(s => s.parts)

  const metrics = useMemo(() => {
    if (parts.length === 0) return null
    const cg = computeCG(parts)
    const frontalArea = computeFrontalArea(parts)
    const cd = estimateDragCoefficient(parts)
    const warnings = validatePhysics(parts)
    const perPart = parts.map(p => ({ name: p.name, mass: computeMass(p) }))
    return { cg, frontalArea, cd, warnings, perPart }
  }, [parts])

  if (!metrics) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>Physics Validation</div>
        <div style={{ color: '#666', fontSize: '11px' }}>Add parts to see metrics</div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>Physics Validation</div>

      <div style={styles.row}>
        <span style={styles.label}>Total Mass</span>
        <span style={styles.value}>{metrics.cg.totalMass.toFixed(2)} kg</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>CG Position</span>
        <span style={styles.value}>
          {metrics.cg.x.toFixed(3)}, {metrics.cg.y.toFixed(3)}, {metrics.cg.z.toFixed(3)}
        </span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Frontal Area</span>
        <span style={styles.value}>{metrics.frontalArea.toFixed(3)} m²</span>
      </div>
      <div style={styles.row}>
        <span style={styles.label}>Est. Cd</span>
        <span style={styles.value}>{metrics.cd.toFixed(3)}</span>
      </div>

      {metrics.perPart.length > 0 && (
        <div style={{ marginTop: '4px' }}>
          <div style={{ ...styles.label, fontSize: '10px', marginBottom: '2px' }}>Per-Part Mass</div>
          {metrics.perPart.map((p, i) => (
            <div key={i} style={styles.partRow}>
              <span>{p.name}</span>
              <span>{p.mass.toFixed(2)} kg</span>
            </div>
          ))}
        </div>
      )}

      {metrics.warnings.length > 0 && (
        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {metrics.warnings.map((w, i) => (
            <div key={i} style={{ ...styles.warning, ...warningStyles[w.level] }}>
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
