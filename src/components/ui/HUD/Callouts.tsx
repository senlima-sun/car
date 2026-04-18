import { useEffect, useRef, useState } from 'react'
import { useTrackLimitsStore } from '@/stores/useTrackLimitsStore'
import { usePitStore } from '@/stores/usePitStore'
import { useSessionStore } from '@/stores/useSessionStore'

type CalloutKind = 'track-limits' | 'pit-speed' | 'pit-exit' | 'invalid-lap' | 'jump-start'

interface Callout {
  id: string
  kind: CalloutKind
  message: string
  at: number
}

const CALLOUT_TTL_MS = 2500
const CALLOUT_COOLDOWN_MS = 1000

const KIND_TONE: Record<CalloutKind, { border: string; bar: string; bg: string; text: string }> = {
  'track-limits': {
    border: 'rgba(255,204,0,0.45)',
    bar: '#ffcc00',
    bg: 'linear-gradient(to right, rgba(80,60,0,0.75), rgba(10,10,10,0.8))',
    text: '#ffe27a',
  },
  'pit-speed': {
    border: 'rgba(239,68,68,0.5)',
    bar: '#ef4444',
    bg: 'linear-gradient(to right, rgba(90,15,15,0.75), rgba(10,10,10,0.8))',
    text: '#ff8b8b',
  },
  'pit-exit': {
    border: 'rgba(0,229,255,0.45)',
    bar: '#00e5ff',
    bg: 'linear-gradient(to right, rgba(0,55,70,0.75), rgba(10,10,10,0.8))',
    text: '#8af0ff',
  },
  'invalid-lap': {
    border: 'rgba(239,68,68,0.5)',
    bar: '#ef4444',
    bg: 'linear-gradient(to right, rgba(90,15,15,0.75), rgba(10,10,10,0.8))',
    text: '#ff8b8b',
  },
  'jump-start': {
    border: 'rgba(239,68,68,0.5)',
    bar: '#ef4444',
    bg: 'linear-gradient(to right, rgba(90,15,15,0.75), rgba(10,10,10,0.8))',
    text: '#ff8b8b',
  },
}

const KIND_LABEL: Record<CalloutKind, string> = {
  'track-limits': 'Track Limits',
  'pit-speed': 'Pit Lane',
  'pit-exit': 'Pit Exit',
  'invalid-lap': 'Invalid Lap',
  'jump-start': 'Jump Start',
}

export default function Callouts() {
  const violationCount = useTrackLimitsStore(s => s.violationCount)
  const isPitSpeeding = usePitStore(s => s.isPitLaneSpeeding)
  const isInPitLane = usePitStore(s => s.isInPitLane)
  const events = useSessionStore(s => s.events)
  const [callouts, setCallouts] = useState<Callout[]>([])
  const lastFireRef = useRef<Record<CalloutKind, number>>({
    'track-limits': 0,
    'pit-speed': 0,
    'pit-exit': 0,
    'invalid-lap': 0,
    'jump-start': 0,
  })

  const push = (kind: CalloutKind, message: string) => {
    const now = Date.now()
    if (now - lastFireRef.current[kind] < CALLOUT_COOLDOWN_MS) return
    lastFireRef.current[kind] = now
    const id = `${kind}-${now}`
    setCallouts(prev => [...prev.slice(-3), { id, kind, message, at: now }])
  }

  useEffect(() => {
    if (violationCount > 0) {
      push('track-limits', `×${violationCount}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [violationCount])

  useEffect(() => {
    if (isInPitLane && isPitSpeeding) {
      push('pit-speed', 'Speeding — slow down')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPitSpeeding, isInPitLane])

  useEffect(() => {
    if (events.length === 0) return
    const last = events[events.length - 1]
    if (last.type === 'lap_invalidated') {
      push('invalid-lap', last.reason.replace(/-/g, ' '))
    } else if (last.type === 'jump_start') {
      push('jump-start', 'Detected')
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
    <div className='absolute top-[30%] right-3 z-30 flex w-[260px] flex-col gap-1.5 pointer-events-none select-none'>
      {callouts.map(c => {
        const tone = KIND_TONE[c.kind]
        return (
          <div
            key={c.id}
            className='relative overflow-hidden border backdrop-blur-md shadow-[0_10px_28px_rgba(0,0,0,0.4)]'
            style={{
              borderColor: tone.border,
              background: tone.bg,
              clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)',
              animation: 'hud-fade-in 180ms ease-out',
            }}
          >
            <div
              className='absolute left-0 top-0 h-full w-[3px]'
              style={{ background: tone.bar, boxShadow: `0 0 10px ${tone.bar}` }}
            />
            <div className='flex items-center justify-between gap-2 pl-3 pr-3 py-1.5'>
              <span
                className='text-[9px] font-bold uppercase tracking-[0.32em]'
                style={{ color: tone.bar }}
              >
                {KIND_LABEL[c.kind]}
              </span>
              <span
                className='font-mono text-[12px] font-semibold uppercase tracking-[0.16em]'
                style={{ color: tone.text }}
              >
                {c.message}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
