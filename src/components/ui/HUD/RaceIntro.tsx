import { useEffect, useState } from 'react'
import { useSessionStore } from '@/stores/useSessionStore'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'

const FADE_MS = 3000

export default function RaceIntro() {
  const config = useSessionStore(s => s.config)
  const phase = useSessionStore(s => s.phase)
  const temperature = useEnvironmentStore(s => s.temperature)
  const rainIntensity = useEnvironmentStore(s => s.rainIntensity)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (phase !== 'running') return
    setVisible(true)
    const t = window.setTimeout(() => setVisible(false), FADE_MS)
    return () => window.clearTimeout(t)
  }, [phase])

  if (!visible || !config) return null

  const weather = rainIntensity > 0.3 ? 'Rain' : temperature > 32 ? 'Hot' : temperature < 8 ? 'Cold' : 'Dry'

  return (
    <div className='absolute top-[12%] left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none animate-[fadeOut_3s_ease-out_forwards]'>
      <div className='rounded-xl border border-white/15 bg-black/60 px-8 py-4 text-center text-white shadow-[0_14px_60px_rgba(0,0,0,0.5)] backdrop-blur-sm'>
        <div className='text-[11px] font-semibold uppercase tracking-[0.32em] text-white/55'>
          {config.kind.replace(/-/g, ' ')}
        </div>
        <div className='mt-1 font-mono text-3xl font-semibold uppercase tracking-[0.16em]'>
          {config.trackId ?? 'Practice Venue'}
        </div>
        <div className='mt-2 flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.24em] text-white/55'>
          <span>Laps {config.lapLimit ?? '—'}</span>
          <span>·</span>
          <span>{weather}</span>
          <span>·</span>
          <span>{temperature.toFixed(0)}°C</span>
        </div>
      </div>
    </div>
  )
}
