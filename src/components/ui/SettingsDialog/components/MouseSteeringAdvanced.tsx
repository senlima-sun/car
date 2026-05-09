import { useGameStore } from '@/stores/useGameStore'
import type { MouseSteeringConfig } from '@/input/steeringMath'

interface SliderRow {
  field: keyof MouseSteeringConfig
  label: string
  hint: string
  min: number
  max: number
  step: number
  format: (v: number) => string
}

const ROWS: SliderRow[] = [
  {
    field: 'gamma',
    label: 'Sensitivity Curve (γ)',
    hint: 'Higher = finer near center, faster near full lock',
    min: 1.0,
    max: 3.0,
    step: 0.1,
    format: v => v.toFixed(1),
  },
  {
    field: 'maxWheelAngleDeg',
    label: 'Max Wheel Angle',
    hint: 'Total wheel rotation from center to full lock',
    min: 90,
    max: 720,
    step: 30,
    format: v => `${v.toFixed(0)}°`,
  },
  {
    field: 'decayRatePerSec',
    label: 'Center Decay',
    hint: 'How fast the wheel returns to center when idle',
    min: 0,
    max: 20,
    step: 0.5,
    format: v => v.toFixed(1),
  },
  {
    field: 'sensitivityRadPerPx',
    label: 'Mouse Sensitivity',
    hint: 'How much wheel rotates per pixel of mouse movement',
    min: 0.002,
    max: 0.025,
    step: 0.001,
    format: v => v.toFixed(3),
  },
  {
    field: 'ratioAtTopSpeed',
    label: 'High-Speed Ratio',
    hint: 'Steering scaling at top speed (lower = stabler at speed)',
    min: 0.3,
    max: 1.0,
    step: 0.05,
    format: v => v.toFixed(2),
  },
]

export function MouseSteeringAdvanced() {
  const config = useGameStore(s => s.mouseSteeringConfig)
  const setMouseSteeringConfig = useGameStore(s => s.setMouseSteeringConfig)
  const resetMouseSteeringConfig = useGameStore(s => s.resetMouseSteeringConfig)

  return (
    <div className='border-l-2 border-white/8 pl-4 ml-2 mb-4'>
      {ROWS.map(row => {
        const value = config[row.field]
        return (
          <div key={row.field} className='flex justify-between items-center py-1.5'>
            <div className='flex-1 pr-3'>
              <div className='text-white/85 text-[12px] font-medium'>{row.label}</div>
              <div className='text-white/35 text-[10px] mt-0.5'>{row.hint}</div>
            </div>
            <div className='flex items-center gap-2'>
              <input
                type='range'
                min={row.min}
                max={row.max}
                step={row.step}
                value={value}
                onChange={e => setMouseSteeringConfig({ [row.field]: Number(e.target.value) })}
                className='w-[110px] accent-white/55'
              />
              <span className='text-white/70 text-[11px] font-mono w-[48px] text-right'>
                {row.format(value)}
              </span>
            </div>
          </div>
        )
      })}
      <div className='flex justify-end mt-2'>
        <button
          onClick={resetMouseSteeringConfig}
          className='rounded-full border border-white/12 bg-white/4 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/75 transition hover:bg-white/10'
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
