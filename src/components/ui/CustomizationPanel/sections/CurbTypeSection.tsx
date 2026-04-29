import { useEditorStore } from '../../../../stores/useEditorStore'
import type { CurbType } from '../../../../types/trackObjects'
import { SectionShell } from '../SectionShell'

const CURB_TYPES: ReadonlyArray<{ type: CurbType; label: string }> = [
  { type: 'apex', label: 'Apex' },
  { type: 'exit', label: 'Exit' },
  { type: 'flat', label: 'Flat' },
]

const MODE_BUTTON_BASE =
  'flex-1 px-2.5 py-1.5 border-2 border-transparent rounded-md cursor-pointer text-[11px] font-bold transition-all duration-200 ease'
const MODE_BUTTON_INACTIVE = 'bg-white/10 text-[#888]'
const MODE_BUTTON_ACTIVE = 'bg-[#eab308]/20 border-[#eab308] text-[#fde68a]'

export default function CurbTypeSection() {
  const selectedCurbType = useEditorStore(s => s.selectedCurbType)

  return (
    <SectionShell title="Curb Type">
      <div className='grid grid-cols-3 gap-1'>
        {CURB_TYPES.map(({ type, label }) => (
          <button
            key={type}
            className={`${MODE_BUTTON_BASE} ${
              selectedCurbType === type ? MODE_BUTTON_ACTIVE : MODE_BUTTON_INACTIVE
            }`}
            onClick={() => useEditorStore.getState().setSelectedCurbType(type)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className='text-[#888] text-[10px] mt-1.5 px-2 py-1.5 bg-white/5 rounded leading-[1.4]'>
        Drag along a road edge to place a {selectedCurbType} curb.
      </div>
    </SectionShell>
  )
}
