import { useCustomizationStore, isLinearObject } from '../../../stores/useCustomizationStore'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'absolute',
    bottom: 68,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0, 0, 0, 0.8)',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    zIndex: 99,
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  step: {
    color: '#00ff00',
    fontWeight: 'bold',
    marginRight: 6,
  },
}

export default function ContextHint() {
  const selectedObjectType = useCustomizationStore(s => s.selectedObjectType)
  const trackMode = useCustomizationStore(s => s.trackMode)
  const placementState = useCustomizationStore(s => s.placementState)
  const deleteMode = useCustomizationStore(s => s.deleteMode)
  const partialDeleteMode = useCustomizationStore(s => s.partialDeleteMode)
  const partialDeleteState = useCustomizationStore(s => s.partialDeleteState)
  const autoCurbMode = useCustomizationStore(s => s.autoCurbMode)
  const selectedRoadIds = useCustomizationStore(s => s.selectedRoadIds)
  const selectedObjectId = useCustomizationStore(s => s.selectedObjectId)

  // Determine hint based on current state
  const getHint = (): { step?: string; text: string } | null => {
    // Delete mode hint
    if (deleteMode) {
      if (selectedObjectId) {
        return { text: 'Press Delete or click trash to remove' }
      }
      return { text: 'Click an object to select it' }
    }

    // Partial delete hint
    if (partialDeleteMode) {
      if (partialDeleteState) {
        return { step: '2.', text: 'Click same road to set end point' }
      }
      return { step: '1.', text: 'Click on a road to set start point' }
    }

    // Auto curb mode hint
    if (autoCurbMode) {
      if (selectedRoadIds.length > 0) {
        return { text: `${selectedRoadIds.length} road(s) selected - click Generate` }
      }
      return { text: 'Click roads to select them' }
    }

    // Object placement hints
    if (!selectedObjectType) return null

    // Non-linear objects (cone, ramp, checkpoint)
    if (!isLinearObject(selectedObjectType)) {
      if (selectedObjectType === 'curb') {
        return { text: 'Click and drag along a road edge' }
      }
      if (selectedObjectType === 'checkpoint') {
        return { text: 'Click on a road to place checkpoint' }
      }
      return { text: 'Click to place, R to rotate' }
    }

    // Linear objects (road, barrier)
    if (trackMode === 'curve') {
      switch (placementState) {
        case 'selecting':
          return { step: '1.', text: 'Click to set START point' }
        case 'dragging':
          return { step: '2.', text: 'Click to set CONTROL point' }
        case 'placingControlPoint':
          return { step: '3.', text: 'Click to set END point' }
        default:
          return null
      }
    } else {
      // Straight mode
      switch (placementState) {
        case 'selecting':
          return { step: '1.', text: 'Click to set START point' }
        case 'dragging':
          return { step: '2.', text: 'Click to set END point' }
        default:
          return null
      }
    }
  }

  const hint = getHint()

  if (!hint) return null

  return (
    <div style={styles.container}>
      {hint.step && <span style={styles.step}>{hint.step}</span>}
      {hint.text}
    </div>
  )
}
