import { useEffect, useState } from 'react'
import { useSessionStore } from '@/stores/useSessionStore'
import { useEnvironmentStore } from '@/stores/useEnvironmentStore'
import { Surface } from '@/components/ui/primitives'

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

  const weather =
    rainIntensity > 0.3 ? 'Rain' : temperature > 32 ? 'Hot' : temperature < 8 ? 'Cold' : 'Dry'

  return (
    <div className='absolute top-[14%] left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none animate-[hud-fade-out_3s_ease-out_forwards]'>
      <Surface variant='cardStrong' className='relative overflow-hidden px-10 py-5'>
        <div className='absolute inset-x-6 top-0 h-0.5 bg-linear-to-r from-transparent via-[#ffcc00] to-transparent' />
        <div className='text-center text-[10px] font-bold uppercase tracking-[0.42em] text-[#ffcc00]'>
          {config.kind.replace(/-/g, ' ')}
        </div>
        <div className='mt-2 text-center font-sans text-[34px] font-bold uppercase leading-none tracking-[0.16em] text-white'>
          {config.trackId ?? 'Practice Venue'}
        </div>
        <div className='mt-3 flex items-center justify-center gap-6 text-[10px] uppercase tracking-[0.32em] text-white/55'>
          <span className='flex items-center gap-1.5'>
            <span className='text-white/35'>Laps</span>
            <span className='font-mono text-white tabular-nums'>{config.lapLimit ?? '—'}</span>
          </span>
          <span className='h-3 w-px bg-white/20' />
          <span className='flex items-center gap-1.5'>
            <span className='text-white/35'>Weather</span>
            <span className='font-mono text-white tabular-nums'>{weather}</span>
          </span>
          <span className='h-3 w-px bg-white/20' />
          <span className='flex items-center gap-1.5'>
            <span className='text-white/35'>Track</span>
            <span className='font-mono text-white tabular-nums'>{temperature.toFixed(0)}°C</span>
          </span>
        </div>
      </Surface>
    </div>
  )
}
