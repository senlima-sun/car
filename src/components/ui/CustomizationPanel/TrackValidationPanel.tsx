import { useState, useCallback } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useTrackGraphStore } from '../../../stores/useTrackGraphStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import {
  validateTrack,
  type TrackValidationReport,
  type ValidationResult,
} from '../../../utils/trackValidation'

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginBottom: 15,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 11,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  validateButton: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 'bold',
    background: '#3b82f6',
    color: '#fff',
    marginBottom: 8,
  },
  resultList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
  },
  resultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 4,
    fontSize: 11,
    cursor: 'pointer',
  },
  icon: {
    fontSize: 14,
    flexShrink: 0,
  },
  message: {
    flex: 1,
  },
  summary: {
    padding: '8px',
    borderRadius: 4,
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center' as const,
  },
}

const severityConfig = {
  critical: { icon: 'X', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  warning: { icon: '!', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  pass: { icon: 'OK', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
}

export default function TrackValidationPanel() {
  const [report, setReport] = useState<TrackValidationReport | null>(null)

  const setCameraTarget = useEditorStore(s => s.setCameraTarget)

  const handleValidate = useCallback(() => {
    const objects = useCustomizationStore.getState().placedObjects
    const graph = useTrackGraphStore.getState().graph
    const result = validateTrack(objects, graph)
    setReport(result)
  }, [])

  const handleResultClick = useCallback((result: ValidationResult) => {
    if (result.location) {
      setCameraTarget(result.location)
    }
  }, [setCameraTarget])

  return (
    <div style={styles.container}>
      <div style={styles.sectionTitle}>Track Validation</div>
      <button style={styles.validateButton} onClick={handleValidate}>
        Validate Track
      </button>

      {report && (
        <>
          <div style={styles.resultList}>
            {report.results.map((result: ValidationResult) => {
              const config = severityConfig[result.severity]
              return (
                <div
                  key={result.id}
                  style={{
                    ...styles.resultItem,
                    background: config.bg,
                    cursor: result.location ? 'pointer' : 'default',
                    opacity: result.location ? 1 : 0.7,
                  }}
                  onClick={() => handleResultClick(result)}
                >
                  <span style={{ ...styles.icon, color: config.color }}>[{config.icon}]</span>
                  <span style={{ ...styles.message, color: config.color }}>{result.message}</span>
                  {result.location && (
                    <span style={{ fontSize: 10, color: '#666', flexShrink: 0 }}>&#x2316;</span>
                  )}
                </div>
              )
            })}
          </div>

          <div
            style={{
              ...styles.summary,
              background: report.canRace
                ? 'rgba(34, 197, 94, 0.15)'
                : 'rgba(239, 68, 68, 0.15)',
              color: report.canRace ? '#22c55e' : '#ef4444',
            }}
          >
            {report.canRace
              ? 'Track is valid — ready to race!'
              : `${report.criticalCount} critical issue(s) must be fixed`}
          </div>
        </>
      )}
    </div>
  )
}
