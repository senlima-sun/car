import { useSessionStore } from '@/stores/useSessionStore'
import { useLapTimeStore } from '@/stores/useLapTimeStore'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { HUD_ACCENT, HUD_DIVIDER_CLASS, HUD_LABEL_CLASS, HudPanel } from './hudChrome'

function formatLapTime(ms: number | null): string {
  if (ms === null) return '—:——.———'
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
  const sessionLabel = config.kind.replace(/-/g, ' ').toUpperCase()

  return (
    <div className='absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none select-none z-30'>
      <HudPanel accent='#ffcc00' contentClassName='flex items-stretch'>
        <Segment label='Session' accent='#ffcc00'>
          <span className='rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-sans text-[11px] font-bold tracking-[0.24em] text-white'>
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

        <Segment label='Best Lap' accent={HUD_ACCENT.battery}>
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
      </HudPanel>
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
    <div className='flex min-w-[90px] flex-col items-start justify-center gap-0.5 px-4 py-2'>
      <span className={HUD_LABEL_CLASS} style={{ color: accent ?? 'rgba(255,255,255,0.42)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function Divider() {
  return <div className={HUD_DIVIDER_CLASS} />
}
