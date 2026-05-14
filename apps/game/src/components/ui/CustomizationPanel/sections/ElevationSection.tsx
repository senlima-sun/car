import { useEditorStore } from '../../../../stores/useEditorStore'
import { useElevationEditStore } from '../../../../stores/useElevationEditStore'
import { SectionShell } from '../SectionShell'

const TOOL_OPTIONS = [
  { tool: 'raise' as const, label: 'Raise' },
  { tool: 'level' as const, label: 'Level' },
  { tool: 'slope' as const, label: 'Slope' },
  { tool: 'smooth' as const, label: 'Smooth' },
]

const DELETE_BUTTON_BASE =
  'w-full px-3 py-2.5 border-2 border-transparent rounded-md cursor-pointer text-xs font-bold transition-all duration-200 ease mb-2.5'
const DELETE_BUTTON_INACTIVE = 'bg-white/10 text-[#888]'
const ELEVATION_ACTIVE = 'bg-[#3b82f6]/30 border-[#3b82f6] text-[#60a5fa]'

const MODE_BUTTON_BASE =
  'flex-1 px-2.5 py-1.5 border-2 border-transparent rounded-md cursor-pointer text-[11px] font-bold transition-all duration-200 ease'
const MODE_BUTTON_INACTIVE = 'bg-white/10 text-[#888]'
const TOOL_ACTIVE = 'bg-[#3b82f6]/20 border-[#3b82f6] text-[#3b82f6]'

const PLACEMENT_HINT =
  'text-[#888] text-[10px] mt-1.5 px-2 py-1.5 bg-white/5 rounded leading-[1.4]'

const ACTION_BUTTON =
  'flex-1 px-3 py-2 border-0 rounded-md cursor-pointer text-xs font-bold transition-all duration-200 ease text-white'

export default function ElevationSection() {
  const elevationEditMode = useEditorStore(s => s.editorMode === 'elevation')
  const elevationTool = useElevationEditStore(s => s.elevationTool)
  const targetLevelHeight = useElevationEditStore(s => s.targetLevelHeight)
  const slopeAnchor = useElevationEditStore(s => s.slopeAnchor)
  const smoothSelectedRoadIds = useElevationEditStore(s => s.smoothSelectedRoadIds)
  const propagateToNeighbors = useElevationEditStore(s => s.propagateToNeighbors)

  const handleToggleElevationMode = () => {
    const editor = useEditorStore.getState()
    if (editor.editorMode === 'elevation') {
      editor.setElevationEditMode(false)
    } else {
      editor.setElevationEditMode(true)
    }
  }

  const handleApplySmooth = () => {
    useElevationEditStore.getState().applySmoothElevation(smoothSelectedRoadIds)
  }

  return (
    <SectionShell title="Elevation">
      <button
        className={`${DELETE_BUTTON_BASE} ${
          elevationEditMode ? ELEVATION_ACTIVE : DELETE_BUTTON_INACTIVE
        }`}
        onClick={handleToggleElevationMode}
      >
        {elevationEditMode ? 'Exit Elevation Mode' : 'Edit Elevation (Y)'}
      </button>

      {elevationEditMode && (
        <>
          <div className='grid grid-cols-2 gap-1 mb-2'>
            {TOOL_OPTIONS.map(({ tool, label }) => (
              <button
                key={tool}
                className={`${MODE_BUTTON_BASE} ${
                  elevationTool === tool ? TOOL_ACTIVE : MODE_BUTTON_INACTIVE
                }`}
                onClick={() => useElevationEditStore.getState().setElevationTool(tool)}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className='flex items-center justify-between px-2 py-1.5 bg-white/5 rounded mb-1.5 cursor-pointer'
            onClick={() =>
              useElevationEditStore.getState().setPropagateToNeighbors(!propagateToNeighbors)
            }
          >
            <span className='text-[#aaa] text-[11px]'>Propagate to neighbors</span>
            <div
              className={`w-9 h-[18px] rounded-[9px] relative transition-colors duration-200 ease ${
                propagateToNeighbors ? 'bg-[#22c55e]' : 'bg-[#444]'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-[7px] bg-white absolute top-0.5 transition-[left] duration-200 ease ${
                  propagateToNeighbors ? 'left-5' : 'left-0.5'
                }`}
              />
            </div>
          </div>

          {elevationTool === 'raise' && (
            <div className={PLACEMENT_HINT}>
              Click and drag road endpoints up/down to change elevation.
            </div>
          )}

          {elevationTool === 'level' && (
            <>
              <div className='flex items-center gap-2 mb-1.5'>
                <span className='text-[#aaa] text-[11px] min-w-[50px]'>Height</span>
                <input
                  type='range'
                  min={0}
                  max={20}
                  step={0.25}
                  value={targetLevelHeight}
                  onChange={e =>
                    useElevationEditStore.getState().setTargetLevelHeight(Number(e.target.value))
                  }
                  className='flex-1 accent-[#3b82f6]'
                />
                <span className='text-white text-xs font-mono min-w-[36px]'>
                  {targetLevelHeight.toFixed(1)}m
                </span>
              </div>
              <div className={PLACEMENT_HINT}>
                Click endpoints to set to target height. Shift+Click sets both endpoints.
              </div>
            </>
          )}

          {elevationTool === 'slope' && (
            <div className={PLACEMENT_HINT}>
              {slopeAnchor
                ? `Anchor set at ${slopeAnchor.height.toFixed(1)}m. Click second endpoint.`
                : 'Click first endpoint to set slope anchor.'}
            </div>
          )}

          {elevationTool === 'smooth' && (
            <>
              <div className={PLACEMENT_HINT}>
                {smoothSelectedRoadIds.length > 0
                  ? `${smoothSelectedRoadIds.length} road(s) selected. Click Apply or press Enter.`
                  : 'Click roads to select for smoothing.'}
              </div>
              {smoothSelectedRoadIds.length > 0 && (
                <div className='flex gap-1.5 mt-1.5'>
                  <button
                    className={`${ACTION_BUTTON} bg-[#3b82f6]`}
                    onClick={handleApplySmooth}
                  >
                    Apply
                  </button>
                  <button
                    className={`${ACTION_BUTTON} bg-[#666]`}
                    onClick={() => useElevationEditStore.getState().clearSmoothSelection()}
                  >
                    Clear
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </SectionShell>
  )
}
