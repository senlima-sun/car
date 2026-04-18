import { useGridStore } from '@/stores/useGridStore'

function formatGap(ms: number | null): string {
  if (ms === null) return '—'
  if (ms < 1000) return `+${(ms / 1000).toFixed(3)}s`
  return `+${(ms / 1000).toFixed(2)}s`
}

export default function TimingTower() {
  const classification = useGridStore(s => s.classification)
  const cars = useGridStore(s => s.cars)

  if (classification.length === 0) return null

  return (
    <div className='absolute left-6 top-24 z-20 pointer-events-none select-none'>
      <div className='w-60 rounded-lg border border-white/10 bg-black/55 p-3 text-[11px] shadow-lg backdrop-blur-sm'>
        <div className='mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.3em] text-white/45'>
          <span>Pos</span>
          <span>Driver</span>
          <span>Gap</span>
        </div>
        {classification.map((id, idx) => {
          const car = cars[id]
          if (!car) return null
          const highlight = car.kind === 'player'
          return (
            <div
              key={id}
              className={
                'flex items-center justify-between py-1 font-mono text-[12px] ' +
                (highlight ? 'text-yellow-200' : 'text-white/85')
              }
            >
              <span className='w-6 text-white/60'>{idx + 1}</span>
              <span className='flex-1 truncate px-2'>{car.driverName}</span>
              <span className='w-14 text-right text-white/70'>
                {idx === 0 ? `L${car.currentLap}` : formatGap(car.intervalToAheadMs)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
