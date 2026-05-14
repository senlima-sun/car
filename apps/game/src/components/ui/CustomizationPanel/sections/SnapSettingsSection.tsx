import { useEditorStore } from '../../../../stores/useEditorStore'
import { SectionShell } from '../SectionShell'

const TOGGLE_ROW =
  'flex items-center justify-between px-2 py-1.5 bg-white/5 rounded mb-1.5 cursor-pointer'
const TOGGLE_LABEL = 'text-[#aaa] text-[11px]'
const TOGGLE_SWITCH_BASE =
  'w-9 h-[18px] rounded-[9px] relative transition-colors duration-200 ease'
const TOGGLE_KNOB_BASE =
  'w-3.5 h-3.5 rounded-[7px] bg-white absolute top-0.5 transition-[left] duration-200 ease'

export default function SnapSettingsSection() {
  const snapSettings = useEditorStore(s => s.snapSettings)

  return (
    <SectionShell title="Snap Settings">
      <div
        className={TOGGLE_ROW}
        onClick={() =>
          useEditorStore.getState().setSnapSettings({ angleSnap: !snapSettings.angleSnap })
        }
      >
        <span className={TOGGLE_LABEL}>Angle Snap (15°/30°/45°/90°)</span>
        <div
          className={`${TOGGLE_SWITCH_BASE} ${
            snapSettings.angleSnap ? 'bg-[#22c55e]' : 'bg-[#444]'
          }`}
        >
          <div
            className={`${TOGGLE_KNOB_BASE} ${snapSettings.angleSnap ? 'left-5' : 'left-0.5'}`}
          />
        </div>
      </div>
      <div
        className={TOGGLE_ROW}
        onClick={() =>
          useEditorStore.getState().setSnapSettings({ tangentSnap: !snapSettings.tangentSnap })
        }
      >
        <span className={TOGGLE_LABEL}>Tangent Continuation</span>
        <div
          className={`${TOGGLE_SWITCH_BASE} ${
            snapSettings.tangentSnap ? 'bg-[#22c55e]' : 'bg-[#444]'
          }`}
        >
          <div
            className={`${TOGGLE_KNOB_BASE} ${snapSettings.tangentSnap ? 'left-5' : 'left-0.5'}`}
          />
        </div>
      </div>
      <div className='text-[#888] text-[10px] mt-1 px-2 py-1.5 bg-white/5 rounded leading-[1.4]'>
        Angle snap aligns roads to grid angles. Tangent continuation creates smooth curves when
        connecting to existing roads.
      </div>
    </SectionShell>
  )
}
