import { useEffect, useState } from 'react'
import { useSessionStore } from '@/stores/useSessionStore'

export default function CountdownOverlay() {
  const phase = useSessionStore(s => s.phase)
  const startSession = useSessionStore(s => s.startSession)
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (phase !== 'countdown') return

    setCount(3)

    const intervalId = window.setInterval(() => {
      setCount(current => {
        if (current <= 1) {
          window.clearInterval(intervalId)
          startSession()
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [phase, startSession])

  if (phase !== 'countdown') return null

  return (
    <div className='absolute inset-0 z-40 flex items-center justify-center bg-black/35 pointer-events-none'>
      <div className='rounded-full border border-red-300/30 bg-[radial-gradient(circle,rgba(190,24,93,0.2),rgba(0,0,0,0.6))] px-12 py-10 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]'>
        <div className='mb-3 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/55'>
          Race Start
        </div>
        <div className='font-mono text-7xl font-semibold uppercase tracking-[0.08em] text-white md:text-8xl'>
          {count > 0 ? count : 'GO'}
        </div>
      </div>
    </div>
  )
}
