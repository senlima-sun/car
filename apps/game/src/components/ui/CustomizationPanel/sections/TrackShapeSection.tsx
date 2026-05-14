import { useEditorStore } from '../../../../stores/useEditorStore'
import { isCurveMode, type PlacementState } from '../../../../types/trackObjects'
import { SectionShell } from '../SectionShell'

const getLinearPlacementHint = (
  placementState: PlacementState,
  curveMode: boolean,
): string | null => {
  if (curveMode) {
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

const MODE_BUTTON_BASE =
  'flex-1 px-2.5 py-1.5 border-2 border-transparent rounded-md cursor-pointer text-[11px] font-bold transition-all duration-200 ease'
const MODE_BUTTON_ACTIVE = 'bg-[#00ff00]/20 border-[#00ff00] text-[#00ff00]'
const MODE_BUTTON_INACTIVE = 'bg-white/10 text-[#888]'

export default function TrackShapeSection() {
  const trackMode = useEditorStore(s => s.trackMode)
  const symmetricCurve = useEditorStore(s => s.symmetricCurve)
  const placementState = useEditorStore(s => s.placementState)

  const curveMode = isCurveMode(trackMode)
  const placementHint = getLinearPlacementHint(placementState, curveMode)

  return (
    <SectionShell title="Track Shape">
      <div className='flex gap-1 mb-2.5'>
        <button
          className={`${MODE_BUTTON_BASE} ${
            trackMode === 'straight' ? MODE_BUTTON_ACTIVE : MODE_BUTTON_INACTIVE
          }`}
          onClick={() => useEditorStore.getState().setTrackMode('straight')}
        >
          Straight
        </button>
        <button
          className={`${MODE_BUTTON_BASE} ${curveMode ? MODE_BUTTON_ACTIVE : MODE_BUTTON_INACTIVE}`}
          onClick={() => useEditorStore.getState().setTrackMode('curve')}
        >
          Curve
        </button>
      </div>
      {curveMode && (
        <div
          className='flex items-center justify-between px-2 py-1.5 bg-white/5 rounded mb-1.5 cursor-pointer'
          onClick={() => useEditorStore.getState().setSymmetricCurve(!symmetricCurve)}
        >
          <span className='text-[#aaa] text-[11px]'>Symmetric Curve</span>
          <div
            className={`w-9 h-[18px] rounded-[9px] relative transition-colors duration-200 ease ${
              symmetricCurve ? 'bg-[#22c55e]' : 'bg-[#444]'
            }`}
          >
            <div
              className={`w-3.5 h-3.5 rounded-[7px] bg-white absolute top-0.5 transition-[left] duration-200 ease ${
                symmetricCurve ? 'left-5' : 'left-0.5'
              }`}
            />
          </div>
        </div>
      )}
      {placementHint && (
        <div className='text-[#888] text-[10px] mt-1.5 px-2 py-1.5 bg-white/5 rounded leading-[1.4]'>
          {placementHint}
        </div>
      )}
    </SectionShell>
  )
}
