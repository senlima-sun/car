import { useEditorStore } from '../../../stores/useEditorStore'
import { useElevationEditStore } from '../../../stores/useElevationEditStore'
import { isLinearObject, isCurveMode } from '../../../types/trackObjects'

const baseContainer: React.CSSProperties = {
  position: 'absolute',
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
}

const styles: Record<string, React.CSSProperties> = {
  step: {
    color: '#00ff00',
    fontWeight: 'bold',
    marginRight: 6,
  },
}

interface ContextHintProps {
  showSecondaryBar?: boolean
}

export default function ContextHint({ showSecondaryBar }: ContextHintProps) {
  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const trackMode = useEditorStore(s => s.trackMode)
  const placementState = useEditorStore(s => s.placementState)
  const deleteMode = useEditorStore(s => s.editorMode === 'delete')
  const partialDeleteMode = useEditorStore(s => s.editorMode === 'partialDelete')
  const partialDeleteState = useEditorStore(s => s.partialDeleteState)
  const autoCurbMode = useEditorStore(s => s.editorMode === 'autoCurb')
  const selectedRoadIds = useEditorStore(s => s.selectedRoadIds)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const elevationEditMode = useEditorStore(s => s.editorMode === 'elevation')
  const elevationTool = useElevationEditStore(s => s.elevationTool)
  const elevationDragState = useElevationEditStore(s => s.elevationDragState)
  const slopeAnchor = useElevationEditStore(s => s.slopeAnchor)
  const smoothSelectedRoadIds = useElevationEditStore(s => s.smoothSelectedRoadIds)

  // Determine hint based on current state
  const getHint = (): { step?: string; text: string } | null => {
    // Elevation edit mode hints
    if (elevationEditMode) {
      if (elevationDragState) {
        return {
          text: `Dragging — ${elevationDragState.currentHeight.toFixed(1)}m  |  Release to confirm, Esc to cancel`,
        }
      }
      switch (elevationTool) {
        case 'raise':
          return { text: 'Drag handles up/down to adjust elevation  |  Y to exit' }
        case 'level':
          return { text: 'Click handle to set height  |  Shift+Click for both ends' }
        case 'slope':
          return slopeAnchor
            ? { step: '2.', text: 'Click second endpoint to create slope' }
            : { step: '1.', text: 'Click first endpoint to set anchor' }
        case 'smooth':
          return smoothSelectedRoadIds.length > 0
            ? {
                text: `${smoothSelectedRoadIds.length} road(s) selected — click Apply or press Enter`,
              }
            : { text: 'Click handles to select roads for smoothing' }
      }
    }

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
    if (isCurveMode(trackMode)) {
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
    <div style={{ ...baseContainer, bottom: showSecondaryBar ? 112 : 68 }}>
      {hint.step && <span style={styles.step}>{hint.step}</span>}
      {hint.text}
    </div>
  )
}
