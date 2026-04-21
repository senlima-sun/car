import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '@/stores/useSessionStore'

type LightPhase = { kind: 'idle' } | { kind: 'lighting'; lit: number } | { kind: 'go' }

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
          timeoutRef.current = window.setTimeout(() => setState({ kind: 'idle' }), 900)
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

  const lit = state.kind === 'lighting' ? state.lit : 0
  const allOut = state.kind === 'go'

  return (
    <div className='absolute inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-none'>
      <div className='flex flex-col items-center gap-4'>
        <Gantry lit={lit} allOut={allOut} />
      </div>
    </div>
  )
}

function Gantry({ lit, allOut }: { lit: number; allOut: boolean }) {
  return (
    <div
      className='relative flex items-center gap-4 rounded-[6px] bg-gradient-to-b from-[#0a0a0a] via-[#1a1a1a] to-[#080808] px-6 py-5 shadow-[0_26px_70px_rgba(0,0,0,0.75)]'
      style={{
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow:
          '0 0 0 1px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05), 0 26px 70px rgba(0,0,0,0.75)',
      }}
    >
      <div className='absolute inset-x-6 -top-[2px] h-[3px] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-60' />
      {[0, 1, 2, 3, 4].map(column => {
        const on = column < lit && !allOut
        return <LightPair key={column} on={on} allOut={allOut} />
      })}
    </div>
  )
}

function LightPair({ on, allOut }: { on: boolean; allOut: boolean }) {
  return (
    <div
      className='flex flex-col items-center gap-2 rounded-[4px] bg-[#050505] px-[10px] py-[10px]'
      style={{
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -2px 4px rgba(0,0,0,0.8)',
      }}
    >
      <Lamp on={on} allOut={allOut} />
      <Lamp on={on} allOut={allOut} />
    </div>
  )
}

function Lamp({ on, allOut }: { on: boolean; allOut: boolean }) {
  const activeBg =
    'radial-gradient(circle at 35% 30%, #ff9494 0%, #ff1a1a 22%, #c80000 55%, #4a0000 85%, #1a0000 100%)'
  const offBg =
    'radial-gradient(circle at 35% 30%, #331414 0%, #1a0808 45%, #090303 80%, #050101 100%)'
  const lit = on && !allOut
  return (
    <div
      className='relative h-[46px] w-[46px] rounded-full'
      style={{
        background: lit ? activeBg : offBg,
        border: '1.5px solid #000',
        boxShadow: lit
          ? '0 0 28px rgba(255,32,32,0.75), 0 0 10px rgba(255,40,40,0.55), inset 0 1px 2px rgba(255,255,255,0.25), inset 0 -2px 6px rgba(0,0,0,0.7)'
          : 'inset 0 2px 4px rgba(0,0,0,0.85), inset 0 -1px 2px rgba(255,255,255,0.02)',
        transition: allOut
          ? 'background 60ms linear, box-shadow 60ms linear'
          : 'background 130ms linear, box-shadow 130ms linear',
      }}
    >
      <div
        className='absolute left-[26%] top-[18%] h-[22%] w-[28%] rounded-full'
        style={{
          background: lit
            ? 'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 70%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 80%)',
          filter: 'blur(1px)',
        }}
      />
    </div>
  )
}
