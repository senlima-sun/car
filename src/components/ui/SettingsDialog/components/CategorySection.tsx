import {
  CONTROL_CATEGORIES,
  type ControlCategory,
  type ControlDefinition,
} from '@/constants/controls'
import { ControlRow } from './ControlRow'

export function CategorySection({
  category,
  controls,
  isTestingMode,
}: {
  category: ControlCategory
  controls: ControlDefinition[]
  isTestingMode: boolean
}) {
  const info = CONTROL_CATEGORIES[category]
  const isLocked = category === 'testingMode' && !isTestingMode

  return (
    <div className='flex-1'>
      <div className='flex items-center gap-2 mb-2.5 pb-1.5 border-b border-white/10'>
        <span className='w-2 h-2 rounded-full' style={{ background: info.color }} />
        <span
          className='text-[12px] font-bold uppercase tracking-wider'
          style={{ color: info.color }}
        >
          {info.label}
        </span>
        {isLocked && (
          <span className='ml-auto text-[10px] px-2 py-0.5 rounded bg-red-500/30 text-red-500'>
            LOCKED
          </span>
        )}
      </div>
      {controls.map(c => (
        <ControlRow key={c.id} control={c} isTestingMode={isTestingMode} />
      ))}
    </div>
  )
}
