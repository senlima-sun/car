import { useFpCameraTuning, FP_CAMERA_DEFAULT } from '@/stores/useFpCameraTuning'

const ROWS: { axis: 'x' | 'y' | 'z'; label: string; min: number; max: number }[] = [
  { axis: 'x', label: 'X (left/right)', min: -1.5, max: 1.5 },
  { axis: 'y', label: 'Y (down/up)', min: 0, max: 2.5 },
  { axis: 'z', label: 'Z (back/forward)', min: 1.5, max: 4.5 },
]

export default function FpCameraTuningPanel() {
  const x = useFpCameraTuning(s => s.x)
  const y = useFpCameraTuning(s => s.y)
  const z = useFpCameraTuning(s => s.z)
  const setX = useFpCameraTuning(s => s.setX)
  const setY = useFpCameraTuning(s => s.setY)
  const setZ = useFpCameraTuning(s => s.setZ)
  const reset = useFpCameraTuning(s => s.reset)

  const values = { x, y, z }
  const setters = { x: setX, y: setY, z: setZ }

  return (
    <div className='absolute top-20 right-5 pointer-events-auto bg-black/70 border border-white/10 rounded px-4 py-3 text-white/85 backdrop-blur-md font-mono text-[11px]'>
      <div className='flex items-center justify-between mb-2'>
        <span className='uppercase tracking-[0.18em] text-[10px] text-white/55'>FP Camera</span>
        <button
          onClick={reset}
          className='text-[10px] text-white/55 hover:text-white/85 underline-offset-2 hover:underline'
        >
          reset
        </button>
      </div>
      {ROWS.map(row => (
        <div key={row.axis} className='flex items-center gap-2 py-0.5'>
          <span className='w-[110px] text-[10px] text-white/55'>{row.label}</span>
          <input
            type='range'
            min={row.min}
            max={row.max}
            step={0.05}
            value={values[row.axis]}
            onChange={e => setters[row.axis](Number(e.target.value))}
            className='w-[140px] accent-white/55'
          />
          <span className='w-[44px] text-right text-white/85'>{values[row.axis].toFixed(2)}</span>
        </div>
      ))}
      <div className='mt-2 pt-2 border-t border-white/10 text-[10px] text-white/45'>
        Default: ({FP_CAMERA_DEFAULT.x.toFixed(2)}, {FP_CAMERA_DEFAULT.y.toFixed(2)},{' '}
        {FP_CAMERA_DEFAULT.z.toFixed(2)})
      </div>
    </div>
  )
}
