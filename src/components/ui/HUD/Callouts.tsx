import { useEffect, useRef, useState } from 'react'
import { useTrackLimitsStore } from '@/stores/useTrackLimitsStore'
import { usePitStore } from '@/stores/usePitStore'
import { useSessionStore } from '@/stores/useSessionStore'

interface Callout {
  id: string
  kind: 'track-limits' | 'pit-speed' | 'pit-exit' | 'invalid-lap' | 'jump-start'
  message: string
  at: number
}

const CALLOUT_TTL_MS = 2500
const CALLOUT_COOLDOWN_MS = 1000

export default function Callouts() {
  const violationCount = useTrackLimitsStore(s => s.violationCount)
  const isPitSpeeding = usePitStore(s => s.isPitLaneSpeeding)
  const isInPitLane = usePitStore(s => s.isInPitLane)
  const events = useSessionStore(s => s.events)
  const [callouts, setCallouts] = useState<Callout[]>([])
  const lastFireRef = useRef<Record<Callout['kind'], number>>({
    'track-limits': 0,
    'pit-speed': 0,
    'pit-exit': 0,
    'invalid-lap': 0,
    'jump-start': 0,
  })

  const push = (kind: Callout['kind'], message: string) => {
    const now = Date.now()
    if (now - lastFireRef.current[kind] < CALLOUT_COOLDOWN_MS) return
    lastFireRef.current[kind] = now
    const id = `${kind}-${now}`
    setCallouts(prev => [...prev.slice(-3), { id, kind, message, at: now }])
  }

  useEffect(() => {
    if (violationCount > 0) {
      push('track-limits', `Track Limits (${violationCount})`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [violationCount])

  useEffect(() => {
    if (isInPitLane && isPitSpeeding) {
      push('pit-speed', 'Pit Lane Speeding — slow down')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPitSpeeding, isInPitLane])

  useEffect(() => {
    if (events.length === 0) return
    const last = events[events.length - 1]
    if (last.type === 'lap_invalidated') {
      push('invalid-lap', `Lap Invalidated — ${last.reason.replace(/-/g, ' ')}`)
    } else if (last.type === 'jump_start') {
      push('jump-start', 'Jump Start detected')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events])

  useEffect(() => {
    if (callouts.length === 0) return
    const t = window.setInterval(() => {
      const now = Date.now()
      setCallouts(prev => prev.filter(c => now - c.at < CALLOUT_TTL_MS))
    }, 250)
    return () => window.clearInterval(t)
  }, [callouts.length])

  if (callouts.length === 0) return null

  return (
    <div className='absolute top-[32%] right-6 z-30 flex flex-col gap-2 pointer-events-none select-none'>
      {callouts.map(c => (
        <div
          key={c.id}
          className='rounded-md border border-yellow-300/40 bg-yellow-900/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-yellow-100 shadow-lg backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]'
        >
          {c.message}
        </div>
      ))}
    </div>
  )
}
