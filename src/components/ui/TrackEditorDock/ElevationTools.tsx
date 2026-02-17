import { useState } from 'react'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { smoothElevations } from '../../../utils/elevationHandles'
import { editorCommandStack } from '../../../utils/commandStack'
import ToolSection, { popoverStyles } from './ToolSection'
import type { EditorCommand } from '../../../types/editor'
import type { ElevationTool } from '../../../types/trackObjects'

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
    borderColor: 'rgba(59, 130, 246, 0.5)',
    background: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
  },
  toolSegmented: {
    display: 'flex',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    padding: 2,
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
    background: 'rgba(59, 130, 246, 0.25)',
    color: '#60a5fa',
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
    minWidth: 45,
  },
  sliderValue: {
    color: '#fff',
    fontSize: 11,
    fontFamily: 'monospace',
    minWidth: 36,
    textAlign: 'right' as const,
  },
  applyButton: {
    width: '100%',
    padding: '6px 12px',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 'bold',
    transition: 'all 0.15s ease',
    marginTop: 6,
  },
  badge: {
    background: '#3b82f6',
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
    padding: '2px 5px',
    borderRadius: 10,
    minWidth: 16,
    textAlign: 'center' as const,
  },
}

const TOOL_LABELS: Record<ElevationTool, string> = {
  raise: 'Raise',
  level: 'Level',
  slope: 'Slope',
  smooth: 'Smooth',
}

export default function ElevationTools() {
  const [popoverOpen, setPopoverOpen] = useState(false)

  const elevationEditMode = useEditorStore(s => s.elevationEditMode)
  const setElevationEditMode = useEditorStore(s => s.setElevationEditMode)
  const elevationTool = useEditorStore(s => s.elevationTool)
  const setElevationTool = useEditorStore(s => s.setElevationTool)
  const targetLevelHeight = useEditorStore(s => s.targetLevelHeight)
  const setTargetLevelHeight = useEditorStore(s => s.setTargetLevelHeight)
  const slopeAnchor = useEditorStore(s => s.slopeAnchor)
  const smoothSelectedRoadIds = useEditorStore(s => s.smoothSelectedRoadIds)
  const clearSmoothSelection = useEditorStore(s => s.clearSmoothSelection)
  const propagateToNeighbors = useEditorStore(s => s.propagateToNeighbors)
  const setPropagateToNeighbors = useEditorStore(s => s.setPropagateToNeighbors)
  const handleToggleElevationMode = () => {
    setElevationEditMode(!elevationEditMode)
  }

  const handleApplySmooth = () => {
    const customStore = useCustomizationStore.getState()
    const result = smoothElevations(smoothSelectedRoadIds, customStore.placedObjects, 1)
    const before = new Map<string, { startElevation: number; endElevation: number }>()
    for (const [id] of result) {
      const obj = customStore.placedObjects.find(o => o.id === id)
      if (obj) {
        before.set(id, {
          startElevation: obj.startElevation ?? 0,
          endElevation: obj.endElevation ?? 0,
        })
      }
    }
    const resultCopy = new Map(result)
    const beforeCopy = new Map(before)
    const command: EditorCommand = {
      execute: () => {
        const store = useCustomizationStore.getState()
        for (const [id, vals] of resultCopy) store.updateObject(id, vals)
      },
      undo: () => {
        const store = useCustomizationStore.getState()
        for (const [id, vals] of beforeCopy) store.updateObject(id, vals)
      },
      description: 'Smooth elevations',
    }
    editorCommandStack.push(command)
    clearSmoothSelection()
  }

  return (
    <div style={styles.container}>
      <ToolSection
        isOpen={popoverOpen && elevationEditMode}
        onToggle={() => setPopoverOpen(prev => !prev)}
        popoverContent={
          <>
            <div style={popoverStyles.title}>Elevation Tools</div>

            <div style={{ display: 'flex', gap: 2, marginBottom: 10 }}>
              {(['raise', 'level', 'slope', 'smooth'] as ElevationTool[]).map(tool => (
                <button
                  key={tool}
                  style={{
                    ...styles.toolSegment,
                    ...(elevationTool === tool ? styles.toolSegmentActive : {}),
                  }}
                  onClick={() => setElevationTool(tool)}
                >
                  {TOOL_LABELS[tool]}
                </button>
              ))}
            </div>

            {elevationTool === 'raise' && (
              <div style={popoverStyles.hint}>Drag handles up/down to change elevation.</div>
            )}

            {elevationTool === 'level' && (
              <>
                <div style={styles.sliderRow}>
                  <span style={styles.sliderLabel}>Height</span>
                  <input
                    type='range'
                    min={0}
                    max={20}
                    step={0.25}
                    value={targetLevelHeight}
                    onChange={e => setTargetLevelHeight(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#3b82f6' }}
                  />
                  <span style={styles.sliderValue}>{targetLevelHeight.toFixed(1)}m</span>
                </div>
                <div style={popoverStyles.hint}>
                  Click endpoints to set height. Shift+Click sets both ends.
                </div>
              </>
            )}

            {elevationTool === 'slope' && (
              <div style={popoverStyles.hint}>
                {slopeAnchor
                  ? `Anchor at ${slopeAnchor.height.toFixed(1)}m — click second endpoint.`
                  : 'Click first endpoint to set anchor.'}
              </div>
            )}

            {elevationTool === 'smooth' && (
              <>
                <div style={popoverStyles.hint}>
                  {smoothSelectedRoadIds.length > 0
                    ? `${smoothSelectedRoadIds.length} road(s) selected.`
                    : 'Click road handles to select.'}
                </div>
                {smoothSelectedRoadIds.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                    <button
                      style={{
                        ...styles.applyButton,
                        background: '#3b82f6',
                        color: '#fff',
                        flex: 1,
                      }}
                      onClick={handleApplySmooth}
                    >
                      Apply
                    </button>
                    <button
                      style={{
                        ...styles.applyButton,
                        background: 'rgba(255,255,255,0.1)',
                        color: '#aaa',
                        flex: 1,
                      }}
                      onClick={clearSmoothSelection}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </>
            )}

            <div
              style={{ marginTop: 10, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}
            >
              <div
                style={{ ...popoverStyles.row, cursor: 'pointer' }}
                onClick={() => setPropagateToNeighbors(!propagateToNeighbors)}
              >
                <span style={popoverStyles.label}>Propagate to neighbors</span>
                <div
                  style={{
                    ...popoverStyles.toggle,
                    background: propagateToNeighbors ? '#22c55e' : '#444',
                  }}
                >
                  <div
                    style={{
                      ...popoverStyles.toggleKnob,
                      left: propagateToNeighbors ? 20 : 2,
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        }
      >
        <button
          style={{
            ...styles.button,
            ...(elevationEditMode ? styles.buttonActive : {}),
          }}
          onClick={() => {
            if (!elevationEditMode) {
              handleToggleElevationMode()
              setPopoverOpen(true)
            } else {
              setPopoverOpen(prev => !prev)
            }
          }}
          title='Elevation edit mode (Y)'
        >
          <svg
            width='14'
            height='14'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
          >
            <path d='M12 2v20M2 12l4-4 4 4M14 8l4-4 4 4' />
          </svg>
          Elevation
          {elevationEditMode && (
            <span style={{ fontSize: 9, opacity: 0.7 }}>{TOOL_LABELS[elevationTool]}</span>
          )}
        </button>
      </ToolSection>

      {elevationEditMode && (
        <button
          style={{
            ...styles.button,
            borderColor: 'rgba(239, 68, 68, 0.3)',
            color: '#f87171',
          }}
          onClick={() => setElevationEditMode(false)}
          title='Exit elevation mode'
        >
          Exit
        </button>
      )}

      {elevationEditMode && elevationTool === 'smooth' && smoothSelectedRoadIds.length > 0 && (
        <button
          style={{
            ...styles.button,
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            fontWeight: 'bold',
          }}
          onClick={handleApplySmooth}
        >
          Apply
          <span style={styles.badge}>{smoothSelectedRoadIds.length}</span>
        </button>
      )}
    </div>
  )
}
