import { listPresetTracks } from '@/constants/tracks'
import { useGameStore } from '@/stores/useGameStore'
import { useSessionStore } from '@/stores/useSessionStore'

function formatLapTime(value: number | null): string {
  if (value === null) return '--:--.---'
  const minutes = Math.floor(value / 60000)
  const seconds = Math.floor((value % 60000) / 1000)
  const milliseconds = Math.floor(value % 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`
}

export default function ResultsScreen() {
  const results = useSessionStore(s => s.results)
  const config = useSessionStore(s => s.config)
  const beginSessionFlow = useSessionStore(s => s.beginSessionFlow)
  const enterMenu = useGameStore(s => s.enterMenu)

  if (!results || !config) return null

  const trackName =
    listPresetTracks().find(track => track.id === results.trackId)?.name ?? 'Current Track'

  return (
    <div className='absolute inset-0 z-40 flex items-center justify-center bg-black/60 px-6 py-8 pointer-events-auto'>
      <div className='w-full max-w-3xl rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(11,13,18,0.96),rgba(11,13,18,0.9))] p-6 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] md:p-8'>
        <div className='space-y-3'>
          <div className='text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45'>
            Session Results
          </div>
          <h2 className='font-mono text-3xl font-semibold uppercase tracking-[0.08em] md:text-4xl'>
            {results.kind.replace('-', ' ')}
          </h2>
          <p className='text-sm text-white/60'>{trackName}</p>
        </div>

        <div className='mt-8 grid gap-3 md:grid-cols-3'>
          <div className='rounded-2xl border border-white/10 bg-white/[0.04] p-4'>
            <div className='text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45'>
              Laps
            </div>
            <div className='mt-3 font-mono text-3xl font-semibold'>{results.lapCount}</div>
          </div>
          <div className='rounded-2xl border border-white/10 bg-white/[0.04] p-4'>
            <div className='text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45'>
              Best Lap
            </div>
            <div className='mt-3 font-mono text-3xl font-semibold text-[#f472b6]'>
              {formatLapTime(results.bestLapTime)}
            </div>
          </div>
          <div className='rounded-2xl border border-white/10 bg-white/[0.04] p-4'>
            <div className='text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45'>
              Last Lap
            </div>
            <div className='mt-3 font-mono text-3xl font-semibold'>
              {formatLapTime(results.lastLapTime)}
            </div>
          </div>
        </div>

        <div className='mt-3 grid gap-3 md:grid-cols-3'>
          <div className='rounded-2xl border border-white/10 bg-white/[0.04] p-4'>
            <div className='text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45'>
              Invalid Laps
            </div>
            <div className='mt-3 font-mono text-3xl font-semibold'>{results.invalidLapCount}</div>
          </div>
          <div className='rounded-2xl border border-white/10 bg-white/[0.04] p-4'>
            <div className='text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45'>
              Penalties
            </div>
            <div className='mt-3 font-mono text-3xl font-semibold text-[#f97316]'>
              +{results.pitLanePenaltySeconds}s
            </div>
          </div>
          <div className='rounded-2xl border border-white/10 bg-white/[0.04] p-4'>
            <div className='text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45'>
              Track Limits
            </div>
            <div className='mt-3 font-mono text-3xl font-semibold'>
              {results.trackLimitsViolations}
            </div>
          </div>
        </div>

        <div className='mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70'>
          {results.testingMode
            ? 'This run used debug-enabled session semantics. Use restart to return to setup with the same engineering context.'
            : 'This run used standard session semantics. Use restart to tweak setup or return to the main menu to choose a new mode.'}
        </div>

        <div className='mt-8 flex flex-col gap-3 md:flex-row md:justify-end'>
          <button
            onClick={() => beginSessionFlow(config.kind, config)}
            className='rounded-full border border-red-300/40 bg-red-500/15 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-red-50 transition hover:bg-red-500/25'
          >
            Restart
          </button>
          <button
            onClick={enterMenu}
            className='rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10 hover:text-white'
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  )
}
