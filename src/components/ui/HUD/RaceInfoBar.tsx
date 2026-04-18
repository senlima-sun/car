import { useSessionStore } from '@/stores/useSessionStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'

function formatLapTime(ms: number | null): string {
  if (ms === null) return '—'
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`
}

export default function RaceInfoBar() {
  const config = useSessionStore(s => s.config)
  const lapCount = useLapTimeStore(s => s.lapCount)
  const bestLapTime = useLapTimeStore(s => s.bestLapTime)
  const temperature = useEnvironmentStore(s => s.temperature)

  if (!config) return null

  const totalLaps = config.lapLimit ?? '—'
  const sessionLabel = config.kind.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase())

  return (
    <div className='absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none select-none'>
      <div className='flex items-center gap-6 rounded-lg border border-white/10 bg-black/55 px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-white/80 shadow-lg backdrop-blur-sm'>
        <div>
          <div className='text-[9px] text-white/45'>Session</div>
          <div className='font-semibold text-white'>{sessionLabel}</div>
        </div>
        <div>
          <div className='text-[9px] text-white/45'>Lap</div>
          <div className='font-mono font-semibold text-white'>
            {lapCount}
            <span className='text-white/40'> / {totalLaps}</span>
          </div>
        </div>
        <div>
          <div className='text-[9px] text-white/45'>Best</div>
          <div className='font-mono font-semibold text-white'>
            {formatLapTime(bestLapTime)}
          </div>
        </div>
        <div>
          <div className='text-[9px] text-white/45'>Track Temp</div>
          <div className='font-mono font-semibold text-white'>{temperature.toFixed(0)}°C</div>
        </div>
      </div>
    </div>
  )
}
