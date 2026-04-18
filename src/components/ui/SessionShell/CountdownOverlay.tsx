import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '@/stores/useSessionStore'

type LightPhase =
  | { kind: 'idle' }
  | { kind: 'lighting'; lit: number }
  | { kind: 'hold'; remainMs: number }
  | { kind: 'go' }

const LIGHT_INTERVAL_MS = 1000
const HOLD_MIN_MS = 500
const HOLD_MAX_MS = 3000

export default function CountdownOverlay() {
  const phase = useSessionStore(s => s.phase)
  const startSession = useSessionStore(s => s.startSession)
  const [state, setState] = useState<LightPhase>({ kind: 'idle' })
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    if (phase !== 'countdown') {
      setState({ kind: 'idle' })
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    let lit = 0
    setState({ kind: 'lighting', lit })

    const illuminate = () => {
      lit++
      if (lit < 5) {
        setState({ kind: 'lighting', lit })
        timeoutRef.current = window.setTimeout(illuminate, LIGHT_INTERVAL_MS)
      } else {
        setState({ kind: 'lighting', lit: 5 })
        const holdMs = HOLD_MIN_MS + Math.random() * (HOLD_MAX_MS - HOLD_MIN_MS)
        timeoutRef.current = window.setTimeout(() => {
          setState({ kind: 'go' })
          startSession()
          timeoutRef.current = window.setTimeout(
            () => setState({ kind: 'idle' }),
            800,
          )
        }, holdMs)
      }
    }
    timeoutRef.current = window.setTimeout(illuminate, LIGHT_INTERVAL_MS)

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [phase, startSession])

  if (phase !== 'countdown' && state.kind === 'idle') return null

  const lit = state.kind === 'lighting' ? state.lit : state.kind === 'hold' ? 5 : 0

  return (
    <div className='absolute inset-0 z-40 flex items-center justify-center bg-black/35 pointer-events-none'>
      <div className='rounded-2xl border border-white/10 bg-black/70 px-10 py-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.5)]'>
        <div className='mb-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/55'>
          {state.kind === 'go' ? 'Lights Out' : 'Formation — Prepare'}
        </div>
        <div className='flex items-center justify-center gap-3'>
          {[0, 1, 2, 3, 4].map(i => (
            <Light key={i} on={i < lit && state.kind !== 'go'} />
          ))}
        </div>
        <div className='mt-4 font-mono text-2xl font-semibold uppercase tracking-[0.12em] text-white'>
          {state.kind === 'go' ? 'GO GO GO' : '—'}
        </div>
      </div>
    </div>
  )
}

function Light({ on }: { on: boolean }) {
  return (
    <div
      className='h-10 w-10 rounded-full border border-black/60'
      style={{
        background: on
          ? 'radial-gradient(circle at 35% 35%, #ff4a4a, #a60000 55%, #3a0000 90%)'
          : 'radial-gradient(circle at 35% 35%, #2a0808, #1a0505 60%, #050000 100%)',
        boxShadow: on ? '0 0 24px rgba(255, 40, 40, 0.7)' : 'inset 0 1px 2px rgba(0,0,0,0.8)',
        transition: 'background 120ms, box-shadow 120ms',
      }}
    />
  )
}
