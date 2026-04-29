import { useCallback, useEffect, useRef, useState } from 'react'
import { useTrackLimitsStore } from '@/stores/useTrackLimitsStore'
import { usePitStore } from '@/stores/usePitStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { STATUS } from '@/constants/colors'
import { HudPanel } from './hudChrome'

type CalloutKind = 'track-limits' | 'pit-speed' | 'pit-exit' | 'invalid-lap' | 'jump-start'

interface Callout {
  id: string
  kind: CalloutKind
  message: string
  expiresAt: number
}

interface Tone {
  border: string
  bar: string
  bg: string
  text: string
}

const CALLOUT_TTL_MS = 2500
const CALLOUT_COOLDOWN_MS = 1000
const MAX_CALLOUTS = 4
const CALLOUT_CLIP =
  'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)'

const DANGER_TONE: Tone = {
  border: 'rgba(239,68,68,0.5)',
  bar: STATUS.danger,
  bg: 'linear-gradient(to right, rgba(90,15,15,0.75), rgba(10,10,10,0.8))',
  text: '#ff8b8b',
}

const KIND_TONE: Record<CalloutKind, Tone> = {
  'track-limits': {
    border: 'rgba(255,204,0,0.45)',
    bar: '#ffcc00',
    bg: 'linear-gradient(to right, rgba(80,60,0,0.75), rgba(10,10,10,0.8))',
    text: '#ffe27a',
  },
  'pit-speed': DANGER_TONE,
  'pit-exit': {
    border: 'rgba(0,229,255,0.45)',
    bar: '#00e5ff',
    bg: 'linear-gradient(to right, rgba(0,55,70,0.75), rgba(10,10,10,0.8))',
    text: '#8af0ff',
  },
  'invalid-lap': DANGER_TONE,
  'jump-start': DANGER_TONE,
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
  const lastNotableEventId = useSessionStore(s => {
    for (let i = s.events.length - 1; i >= 0; i--) {
      const e = s.events[i]
      if (e.type === 'lap_invalidated' || e.type === 'jump_start') return e.id
    }
    return null
  })
  const [callouts, setCallouts] = useState<Callout[]>([])
  const lastFireRef = useRef<Record<CalloutKind, number>>({
    'track-limits': 0,
    'pit-speed': 0,
    'pit-exit': 0,
    'invalid-lap': 0,
    'jump-start': 0,
  })
  const wasPitSpeedingRef = useRef(false)

  const push = useCallback((kind: CalloutKind, message: string) => {
    const now = Date.now()
    if (now - lastFireRef.current[kind] < CALLOUT_COOLDOWN_MS) return
    lastFireRef.current[kind] = now
    const id = `${kind}-${now}`
    setCallouts(prev => [
      ...prev.slice(-(MAX_CALLOUTS - 1)),
      { id, kind, message, expiresAt: now + CALLOUT_TTL_MS },
    ])
  }, [])

  useEffect(() => {
    if (violationCount > 0) push('track-limits', `×${violationCount}`)
  }, [violationCount, push])

  useEffect(() => {
    const speeding = isInPitLane && isPitSpeeding
    if (speeding && !wasPitSpeedingRef.current) push('pit-speed', 'Speeding — slow down')
    wasPitSpeedingRef.current = speeding
  }, [isPitSpeeding, isInPitLane, push])

  useEffect(() => {
    if (!lastNotableEventId) return
    const events = useSessionStore.getState().events
    const event = events.find(e => e.id === lastNotableEventId)
    if (!event) return
    if (event.type === 'lap_invalidated') push('invalid-lap', event.reason.replace(/-/g, ' '))
    else if (event.type === 'jump_start') push('jump-start', 'Detected')
  }, [lastNotableEventId, push])

  useEffect(() => {
    if (callouts.length === 0) return
    const now = Date.now()
    const nextExpiry = Math.min(...callouts.map(c => c.expiresAt))
    const t = window.setTimeout(() => {
      const t2 = Date.now()
      setCallouts(prev => prev.filter(c => c.expiresAt > t2))
    }, Math.max(0, nextExpiry - now))
    return () => window.clearTimeout(t)
  }, [callouts])

  if (callouts.length === 0) return null

  return (
    <div className='absolute top-[30%] right-3 z-30 flex w-[260px] flex-col gap-1.5 pointer-events-none select-none'>
      {callouts.map(c => {
        const tone = KIND_TONE[c.kind]
        return (
          <HudPanel
            key={c.id}
            edge='left'
            accent={tone.bar}
            clipPath={CALLOUT_CLIP}
            style={{ borderColor: tone.border, background: tone.bg, animation: 'hud-fade-in 180ms ease-out' }}
            contentClassName='flex items-center justify-between gap-2 pl-3 pr-3 py-1.5'
          >
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
          </HudPanel>
        )
      })}
    </div>
  )
}
