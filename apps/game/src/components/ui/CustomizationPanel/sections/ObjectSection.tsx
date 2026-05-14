import { useCustomizationStore, type ObjectType } from '../../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../../stores/useEditorStore'
import { useCheckpointDragStore } from '../../../../stores/useCheckpointDragStore'
import {
  isWallType,
  isPolygonObject,
  isCurveMode,
  isLinearObject,
  type PlacementState,
  type TrackMode,
} from '../../../../types/trackObjects'
import { OBJECT_TYPES } from '../../../../constants/trackObjects'
import ObjectButton from '../ObjectButton'
import WallPropertiesPanel from '../WallPropertiesPanel'
import CurbPropertiesPanel from '../CurbPropertiesPanel'
import { SectionShell } from '../SectionShell'

const DELETE_BUTTON_BASE =
  'w-full px-3 py-2.5 border-2 border-transparent rounded-md cursor-pointer text-xs font-bold transition-all duration-200 ease mb-2.5'
const DELETE_BUTTON_INACTIVE = 'bg-white/10 text-[#888]'
const DELETE_BUTTON_ACTIVE = 'bg-[#dc2626]/30 border-[#dc2626] text-[#ff6b6b]'
const PARTIAL_DELETE_ACTIVE = 'bg-[#ff6400]/30 border-[#ff6400] text-[#ff9944]'

const PLACEMENT_HINT =
  'text-[#888] text-[10px] mt-1.5 px-2 py-1.5 bg-white/5 rounded leading-[1.4]'

const SELECTED_INFO =
  'text-[#ff6b6b] text-[11px] p-2 bg-[#dc2626]/20 rounded mt-1.5 text-center'

const ACTION_BUTTON =
  'flex-1 px-3 py-2 border-0 rounded-md cursor-pointer text-xs font-bold transition-all duration-200 ease'
const CLEAR_BUTTON = 'bg-[#dc2626] text-white'

const getPlacementHint = (
  selectedObjectType: ObjectType | null,
  placementState: PlacementState,
  polygonPointsLength: number,
  trackMode: TrackMode,
): string | null => {
  if (!selectedObjectType) return null

  if (isPolygonObject(selectedObjectType)) {
    if (placementState === 'polygonDrawing') {
      const points = polygonPointsLength
      if (points === 0) return 'Click to add first point'
      if (points === 1) return `1 point placed • Click to add more points`
      if (points === 2)
        return `${points} points • Click to add more • Need at least 3 points`
      return `${points} points • Double-click or Enter to close • Backspace to undo • Esc to cancel`
    }
    return 'Click to start drawing polygon • Double-click or Enter to close'
  }

  if (!isLinearObject(selectedObjectType)) return 'Click to place'

  if (isCurveMode(trackMode)) {
    switch (placementState) {
      case 'selecting':
        return '1. Click to set START point'
      case 'dragging':
        return '2. Click to set CONTROL point (curve direction)'
      case 'placingControlPoint':
        return '3. Click to set END point'
      default:
        return null
    }
  }

  switch (placementState) {
    case 'selecting':
      return '1. Click to set START point'
    case 'dragging':
      return '2. Click to set END point'
    default:
      return null
  }
}

export default function ObjectSection() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)

  const selectedObjectType = useEditorStore(s => s.selectedObjectType)
  const trackMode = useEditorStore(s => s.trackMode)
  const placementState = useEditorStore(s => s.placementState)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const deleteMode = useEditorStore(s => s.editorMode === 'delete')
  const polygonPoints = useEditorStore(s => s.polygonPoints)
  const partialDeleteMode = useEditorStore(s => s.editorMode === 'partialDelete')
  const partialDeleteState = useEditorStore(s => s.partialDeleteState)
  const multiSelectedIds = useEditorStore(s => s.multiSelectedIds)

  const handleSelectType = (type: ObjectType) => {
    const editor = useEditorStore.getState()
    if (editor.editorMode === 'delete') editor.setDeleteMode(false)
    if (editor.editorMode === 'partialDelete') editor.setPartialDeleteMode(false)
    if (editor.selectedObjectType === type) {
      editor.selectObjectType(null)
    } else {
      editor.selectObjectType(type)
    }
  }

  const handleToggleDeleteMode = () => {
    const editor = useEditorStore.getState()
    if (editor.editorMode === 'partialDelete') editor.setPartialDeleteMode(false)
    if (editor.editorMode === 'delete') {
      editor.setDeleteMode(false)
    } else {
      editor.selectObjectType(null)
      editor.setDeleteMode(true)
    }
  }

  const handleTogglePartialDeleteMode = () => {
    const editor = useEditorStore.getState()
    if (editor.editorMode === 'delete') editor.setDeleteMode(false)
    if (editor.editorMode === 'partialDelete') {
      editor.cancelPartialDelete()
      editor.setPartialDeleteMode(false)
    } else {
      editor.selectObjectType(null)
      editor.setPartialDeleteMode(true)
    }
  }

  const handleDeleteSelected = () => {
    if (!selectedObjectId) return
    const editor = useEditorStore.getState()
    const obj = placedObjects.find(o => o.id === selectedObjectId)
    if (obj?.type === 'checkpoint' && obj.checkpointType === 'sector') {
      useCheckpointDragStore.getState().deleteSectorCheckpoint(selectedObjectId, () =>
        editor.selectObject(null),
      )
    } else {
      useCustomizationStore.getState().removeObject(selectedObjectId)
      editor.selectObject(null)
    }
  }

  const selectedObject = selectedObjectId
    ? placedObjects.find(obj => obj.id === selectedObjectId)
    : null

  const isSectorCheckpoint =
    selectedObject?.type === 'checkpoint' && selectedObject.checkpointType === 'sector'

  const sectorCheckpoints = placedObjects
    .filter(o => o.type === 'checkpoint' && o.checkpointType === 'sector')
    .sort((a, b) => (a.checkpointOrder ?? 0) - (b.checkpointOrder ?? 0))

  const sectorIndex = isSectorCheckpoint
    ? sectorCheckpoints.findIndex(s => s.id === selectedObject.id)
    : -1

  const placementHint = getPlacementHint(
    selectedObjectType,
    placementState,
    polygonPoints.length,
    trackMode,
  )

  const sectorUpDisabled = sectorIndex <= 0
  const sectorDownDisabled = sectorIndex >= sectorCheckpoints.length - 1

  return (
    <SectionShell title="Objects">
      <div className='grid grid-cols-3 gap-1.5 mb-[15px]'>
        {OBJECT_TYPES.map(type => (
          <ObjectButton
            key={type}
            type={type}
            isSelected={selectedObjectType === type}
            onClick={() => handleSelectType(type)}
          />
        ))}
      </div>

      <button
        className={`${DELETE_BUTTON_BASE} ${
          deleteMode ? DELETE_BUTTON_ACTIVE : DELETE_BUTTON_INACTIVE
        }`}
        onClick={handleToggleDeleteMode}
      >
        {deleteMode ? 'Exit Delete Mode' : 'Delete Objects'}
      </button>

      <button
        className={`${DELETE_BUTTON_BASE} ${
          partialDeleteMode ? PARTIAL_DELETE_ACTIVE : DELETE_BUTTON_INACTIVE
        }`}
        onClick={handleTogglePartialDeleteMode}
      >
        {partialDeleteMode ? 'Exit Partial Delete' : 'Partial Delete Road'}
      </button>

      {selectedObjectType && isPolygonObject(selectedObjectType) && placementHint && (
        <div className={PLACEMENT_HINT}>{placementHint}</div>
      )}

      {deleteMode && (
        <div className={PLACEMENT_HINT}>
          Click on an object to select it, then press Delete or click the delete button below
        </div>
      )}

      {partialDeleteMode && (
        <div className={PLACEMENT_HINT}>
          {partialDeleteState
            ? '2. Click on the same road to set end point and delete segment'
            : '1. Click on a road to set start point'}
        </div>
      )}

      {selectedObject && !isSectorCheckpoint && (
        <div className={SELECTED_INFO}>
          Selected: {selectedObject.type}
          <button
            className={`${ACTION_BUTTON} ${CLEAR_BUTTON} mt-1.5 w-full`}
            onClick={handleDeleteSelected}
          >
            Delete Selected
          </button>
        </div>
      )}

      {selectedObject && isWallType(selectedObject.type) && !deleteMode && (
        <WallPropertiesPanel />
      )}

      {selectedObject?.type === 'curb' && !deleteMode && <CurbPropertiesPanel />}

      {isSectorCheckpoint && selectedObject && (
        <div className='p-2.5 bg-[#3b82f6]/15 rounded-md mt-1.5'>
          <div className='text-[#60a5fa] text-[13px] font-bold mb-2'>
            Sector S{selectedObject.checkpointOrder ?? '?'}
          </div>
          <div className='flex gap-1.5 mb-2'>
            <button
              className={`${ACTION_BUTTON} flex-1 ${
                sectorUpDisabled
                  ? 'bg-[#333] text-[#666] cursor-not-allowed opacity-50'
                  : 'bg-[#3b82f6] text-white opacity-100 cursor-pointer'
              }`}
              disabled={sectorUpDisabled}
              onClick={() =>
                useCheckpointDragStore.getState().reorderSectorCheckpoint(selectedObject.id, 'up')
              }
            >
              Move Up
            </button>
            <button
              className={`${ACTION_BUTTON} flex-1 ${
                sectorDownDisabled
                  ? 'bg-[#333] text-[#666] cursor-not-allowed opacity-50'
                  : 'bg-[#3b82f6] text-white opacity-100 cursor-pointer'
              }`}
              disabled={sectorDownDisabled}
              onClick={() =>
                useCheckpointDragStore.getState().reorderSectorCheckpoint(selectedObject.id, 'down')
              }
            >
              Move Down
            </button>
          </div>
          <button
            className={`${ACTION_BUTTON} ${CLEAR_BUTTON} w-full`}
            onClick={() =>
              useCheckpointDragStore.getState().deleteSectorCheckpoint(selectedObject.id, () =>
                useEditorStore.getState().selectObject(null),
              )
            }
          >
            Delete Sector
          </button>
          <div className='text-[#888] text-[10px] mt-1.5'>
            Drag handles to reposition. Esc to cancel drag.
          </div>
        </div>
      )}

      {multiSelectedIds.length > 0 && (
        <div className={SELECTED_INFO}>
          {multiSelectedIds.length} objects selected (Shift+Click)
          <div className='flex gap-1.5 mt-1.5'>
            <button
              className={`${ACTION_BUTTON} ${CLEAR_BUTTON} flex-1`}
              onClick={() => useEditorStore.getState().deleteMultiSelected()}
            >
              Delete All
            </button>
            <button
              className={`${ACTION_BUTTON} bg-[#666] text-white flex-1`}
              onClick={() => useEditorStore.getState().clearMultiSelection()}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </SectionShell>
  )
}
