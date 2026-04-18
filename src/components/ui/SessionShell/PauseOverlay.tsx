import { useGameStore } from '@/stores/useGameStore'
import { useSessionStore } from '@/stores/useSessionStore'

export default function PauseOverlay() {
  const phase = useSessionStore(s => s.phase)
  const resumeSession = useSessionStore(s => s.resumeSession)
  const finishSession = useSessionStore(s => s.finishSession)
  const enterMenu = useGameStore(s => s.enterMenu)
  const openSettings = useGameStore(s => s.openSettings)

  if (phase !== 'paused') return null

  return (
    <div className='absolute inset-0 z-40 flex items-center justify-center bg-black/55 px-6 py-8 pointer-events-auto'>
      <div className='w-full max-w-xl rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(10,12,16,0.96),rgba(10,12,16,0.9))] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)]'>
        <div className='mb-6 space-y-2'>
          <div className='text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45'>
            Session Paused
          </div>
          <h2 className='font-mono text-3xl font-semibold uppercase tracking-[0.08em]'>
            Hold Position
          </h2>
        </div>

        <div className='grid gap-3'>
          <button
            onClick={resumeSession}
            className='rounded-2xl border border-red-300/40 bg-red-500/15 px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-red-50 transition hover:bg-red-500/25'
          >
            Resume
          </button>
          <button
            onClick={openSettings}
            className='rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/10'
          >
            Settings
          </button>
          <button
            onClick={() => finishSession()}
            className='rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-white/80 transition hover:bg-white/10'
          >
            End Session
          </button>
          <button
            onClick={enterMenu}
            className='rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left text-sm font-semibold uppercase tracking-[0.18em] text-white/55 transition hover:bg-white/10 hover:text-white'
          >
            Quit To Menu
          </button>
        </div>
      </div>
    </div>
  )
}
