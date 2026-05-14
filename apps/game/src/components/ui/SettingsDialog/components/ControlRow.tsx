import type { ControlDefinition } from '@/constants/controls'
import { KeyBadge } from './KeyBadge'

export function ControlRow({
  control,
  isTestingMode,
}: {
  control: ControlDefinition
  isTestingMode: boolean
}) {
  const isDisabled = control.testingModeOnly && !isTestingMode
  return (
    <div className='flex items-center py-1.5 gap-3'>
      <div className={`flex gap-1 shrink-0 ${isDisabled ? 'opacity-40' : ''}`}>
        {control.keys.map((key, idx) => (
          <KeyBadge key={idx} keyName={key} />
        ))}
      </div>
      <div className='flex-1 h-px bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.2)_0px,rgba(255,255,255,0.2)_4px,transparent_4px,transparent_8px)] min-w-[20px]' />
      <span
        className={`text-white text-[13px] shrink-0 ${isDisabled ? 'opacity-40' : 'opacity-90'}`}
      >
        {control.displayName}
      </span>
      {control.testingModeOnly && !isTestingMode && (
        <span className='text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 ml-2'>
          TEST
        </span>
      )}
    </div>
  )
}
