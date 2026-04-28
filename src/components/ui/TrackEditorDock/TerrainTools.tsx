import { useState } from 'react'
import { useEditorStore } from '../../../stores/useEditorStore'
import { useTerrainBrushStore } from '../../../stores/useTerrainBrushStore'
import ToolSection, { popoverStyles } from './ToolSection'
import type { TerrainBrushType } from '../../../utils/terrainBrush'

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  button: {
    height: 32,
    padding: '0 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    background: 'rgba(255, 255, 255, 0.05)',
    color: 'rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: 11,
    fontWeight: 500,
  },
  buttonActive: {
    borderColor: 'rgba(34, 197, 94, 0.5)',
    background: 'rgba(34, 197, 94, 0.15)',
    color: '#4ade80',
  },
  toolSegment: {
    padding: '4px 8px',
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  toolSegmentActive: {
    background: 'rgba(34, 197, 94, 0.25)',
    color: '#4ade80',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
  },
  sliderLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    minWidth: 50,
  },
  sliderValue: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'monospace',
    minWidth: 36,
    textAlign: 'right' as const,
  },
}

const BRUSH_LABELS: Record<TerrainBrushType, string> = {
  raise: 'Raise',
  lower: 'Lower',
  flatten: 'Flatten',
  smooth: 'Smooth',
}

export default function TerrainTools() {
  const [popoverOpen, setPopoverOpen] = useState(false)

  const terrainEditMode = useEditorStore(s => s.terrainEditMode)
  const setTerrainEditMode = useEditorStore(s => s.setTerrainEditMode)
  const terrainBrushType = useTerrainBrushStore(s => s.terrainBrushType)
  const setTerrainBrushType = useTerrainBrushStore(s => s.setBrushType)
  const terrainBrushRadius = useTerrainBrushStore(s => s.terrainBrushRadius)
  const setTerrainBrushRadius = useTerrainBrushStore(s => s.setBrushRadius)
  const terrainBrushStrength = useTerrainBrushStore(s => s.terrainBrushStrength)
  const setTerrainBrushStrength = useTerrainBrushStore(s => s.setBrushStrength)
  const terrainFlattenTarget = useTerrainBrushStore(s => s.terrainFlattenTarget)
  const setTerrainFlattenTarget = useTerrainBrushStore(s => s.setFlattenTarget)

  return (
    <div style={styles.container}>
      <ToolSection
        isOpen={popoverOpen && terrainEditMode}
        onToggle={() => setPopoverOpen(prev => !prev)}
        popoverContent={
          <>
            <div style={popoverStyles.title}>Terrain Tools</div>

            <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
              {(['raise', 'lower', 'flatten', 'smooth'] as TerrainBrushType[]).map(tool => (
                <button
                  key={tool}
                  style={{
                    ...styles.toolSegment,
                    ...(terrainBrushType === tool ? styles.toolSegmentActive : {}),
                  }}
                  onClick={() => setTerrainBrushType(tool)}
                >
                  {BRUSH_LABELS[tool]}
                </button>
              ))}
            </div>

            <div style={styles.sliderRow}>
              <span style={styles.sliderLabel}>Size</span>
              <input
                type='range'
                min={5}
                max={50}
                step={1}
                value={terrainBrushRadius}
                onChange={e => setTerrainBrushRadius(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#22c55e' }}
              />
              <span style={styles.sliderValue}>{terrainBrushRadius}m</span>
            </div>

            <div style={styles.sliderRow}>
              <span style={styles.sliderLabel}>Strength</span>
              <input
                type='range'
                min={0.1}
                max={5.0}
                step={0.1}
                value={terrainBrushStrength}
                onChange={e => setTerrainBrushStrength(Number(e.target.value))}
                style={{ flex: 1, accentColor: '#22c55e' }}
              />
              <span style={styles.sliderValue}>{terrainBrushStrength.toFixed(1)}</span>
            </div>

            {terrainBrushType === 'flatten' && (
              <div style={styles.sliderRow}>
                <span style={styles.sliderLabel}>Target</span>
                <input
                  type='range'
                  min={-10}
                  max={30}
                  step={0.5}
                  value={terrainFlattenTarget}
                  onChange={e => setTerrainFlattenTarget(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#22c55e' }}
                />
                <span style={styles.sliderValue}>{terrainFlattenTarget.toFixed(1)}m</span>
              </div>
            )}

            <div style={popoverStyles.hint}>
              Click and drag on the terrain to sculpt. Ctrl+Z to undo.
            </div>
          </>
        }
      >
        <button
          style={{
            ...styles.button,
            ...(terrainEditMode ? styles.buttonActive : {}),
          }}
          onClick={() => {
            if (!terrainEditMode) {
              setTerrainEditMode(true)
              setPopoverOpen(true)
            } else {
              setPopoverOpen(prev => !prev)
            }
          }}
          title='Terrain sculpting mode'
        >
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
            <path d='M2 22L8 16M8 16L14 10C15.5 8.5 17 7 19 7C21 7 22 8.5 22 10C22 12 20 13.5 18 14L12 16L8 16Z' />
            <path d='M2 22C4 20 6 16 8 12' />
          </svg>
          Terrain
          {terrainEditMode && (
            <span style={{ fontSize: 9, opacity: 0.7 }}>{BRUSH_LABELS[terrainBrushType]}</span>
          )}
        </button>
      </ToolSection>

      {terrainEditMode && (
        <button
          style={{
            ...styles.button,
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#f87171',
          }}
          onClick={() => setTerrainEditMode(false)}
          title='Exit terrain mode'
        >
          Exit
        </button>
      )}
    </div>
  )
}
