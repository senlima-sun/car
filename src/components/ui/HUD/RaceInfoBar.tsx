import { useSessionStore } from '@/stores/useSessionStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'

function formatLapTime(ms: number | null): string {
  if (ms === null) return '—:——.———'
  const totalSeconds = ms / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`
}

const BROADCAST_CLIP = 'polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%, 0 10px)'

export default function RaceInfoBar() {
  const config = useSessionStore(s => s.config)
  const lapCount = useLapTimeStore(s => s.lapCount)
  const bestLapTime = useLapTimeStore(s => s.bestLapTime)
  const temperature = useEnvironmentStore(s => s.temperature)

  if (!config) return null

  const totalLaps = config.lapLimit ?? '—'
  const sessionLabel = config.kind.replace(/-/g, ' ').toUpperCase()

  return (
    <div className='absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none select-none z-30'>
      <div
        className='relative flex items-stretch border border-white/10 bg-gradient-to-b from-black/85 to-black/70 backdrop-blur-md shadow-[0_14px_40px_rgba(0,0,0,0.5)]'
        style={{ clipPath: BROADCAST_CLIP }}
      >
        <div className='absolute inset-x-3 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#ffcc00] to-transparent opacity-70' />

        <Segment label='Session' accent='#ffcc00'>
          <span className='font-sans text-[12px] font-bold tracking-[0.2em] text-white'>
            {sessionLabel}
          </span>
        </Segment>

        <Divider />

        <Segment label='Lap'>
          <span className='font-mono text-[15px] font-semibold tabular-nums text-white'>
            {String(lapCount).padStart(2, '0')}
            <span className='mx-0.5 text-white/30'>/</span>
            <span className='text-white/55'>{totalLaps}</span>
          </span>
        </Segment>

        <Divider />

        <Segment label='Best Lap' accent='#b388ff'>
          <span className='font-mono text-[15px] font-semibold tabular-nums text-white'>
            {formatLapTime(bestLapTime)}
          </span>
        </Segment>

        <Divider />

        <Segment label='Track'>
          <span className='font-mono text-[15px] font-semibold tabular-nums text-white'>
            {temperature.toFixed(0)}
            <span className='text-white/45 text-[11px] ml-0.5'>°C</span>
          </span>
        </Segment>
      </div>
    </div>
  )
}

function Segment({
  label,
  accent,
  children,
}: {
  label: string
  accent?: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col items-start justify-center gap-0.5 px-4 py-2 min-w-[86px]'>
      <span
        className='text-[8px] font-semibold uppercase tracking-[0.32em]'
        style={{ color: accent ?? 'rgba(255,255,255,0.42)' }}
      >
        {label}
      </span>
      {children}
    </div>
  )
}

function Divider() {
  return (
    <div className='w-px self-stretch bg-gradient-to-b from-transparent via-white/15 to-transparent' />
  )
}
