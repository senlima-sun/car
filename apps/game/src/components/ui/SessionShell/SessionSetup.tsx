import { PRESET_TRACK_METAS } from '@/constants/tracks'
import { useGameStore } from '@/stores/useGameStore'
import { useSessionStore } from '@/stores/useSessionStore'
import { Surface } from '@/components/ui/primitives'
import { useTrackStore } from '@/stores/useTrackStore'
import { createSessionConfig, type SessionKind } from '@/types/session'

const SESSION_LABELS: Record<SessionKind, string> = {
  practice: 'Practice',
  qualifying: 'Qualifying',
  race: 'Race',
  'time-trial': 'Time Trial',
}

export default function SessionSetup() {
  const config = useSessionStore(s => s.config)
  const configureSession = useSessionStore(s => s.configureSession)
  const startCountdown = useSessionStore(s => s.startCountdown)
  const enterMenu = useGameStore(s => s.enterMenu)
  const loadPresetTrack = useTrackStore(s => s.loadPresetTrack)

  if (!config) return null

  const applyKind = (kind: SessionKind) => {
    configureSession(
      createSessionConfig(kind, {
        trackId: config.trackId,
        testingMode: config.testingMode,
      }),
    )
  }

  const handleStart = () => {
    if (config.trackId) {
      loadPresetTrack(config.trackId)
    }
    startCountdown()
  }

  return (
    <div className='absolute inset-0 z-30 flex items-center justify-center bg-black/50 px-6 py-8 pointer-events-auto'>
      <Surface variant='cardStrong' className='w-full max-w-4xl p-6 md:p-8'>
        <div className='flex flex-col gap-6 md:flex-row md:items-start md:justify-between'>
          <div className='space-y-3'>
            <div className='inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70'>
              Session Setup
            </div>
            <div className='space-y-2'>
              <h2 className='font-mono text-3xl font-semibold uppercase tracking-[0.08em] text-white md:text-4xl'>
                {SESSION_LABELS[config.kind]}
              </h2>
              <p className='max-w-xl text-sm leading-6 text-white/65'>
                Configure the run, pick a circuit, and choose whether this session should behave
                like a clean race weekend pass or a debug-friendly engineering run.
              </p>
            </div>
          </div>

          <div className='grid grid-cols-2 gap-2'>
            {(['practice', 'qualifying', 'race', 'time-trial'] as SessionKind[]).map(kind => (
              <button
                key={kind}
                onClick={() => applyKind(kind)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                  config.kind === kind
                    ? 'border-red-300/50 bg-red-500/12 text-white'
                    : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white'
                }`}
              >
                {SESSION_LABELS[kind]}
              </button>
            ))}
          </div>
        </div>

        <div className='mt-8 grid gap-4 md:grid-cols-2'>
          <label className='space-y-2'>
            <span className='text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45'>
              Track
            </span>
            <select
              value={config.trackId ?? ''}
              onChange={event =>
                configureSession({ kind: config.kind, trackId: event.target.value })
              }
              className='w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-red-300/40'
            >
              {PRESET_TRACK_METAS.map(track => (
                <option key={track.id} value={track.id} className='bg-[#0b0d12]'>
                  {track.name}
                </option>
              ))}
            </select>
          </label>

          <label className='space-y-2'>
            <span className='text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45'>
              Weather
            </span>
            <select
              value={config.weatherPreset}
              onChange={event =>
                configureSession({
                  kind: config.kind,
                  weatherPreset: event.target.value as typeof config.weatherPreset,
                })
              }
              className='w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-red-300/40'
            >
              <option value='current' className='bg-[#0b0d12]'>
                Current Conditions
              </option>
              <option value='dry' className='bg-[#0b0d12]'>
                Dry
              </option>
              <option value='wet' className='bg-[#0b0d12]'>
                Wet
              </option>
              <option value='random' className='bg-[#0b0d12]'>
                Random
              </option>
            </select>
          </label>

          <label className='space-y-2'>
            <span className='text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45'>
              Lap Target
            </span>
            <input
              type='number'
              min={1}
              max={99}
              value={config.lapLimit ?? ''}
              onChange={event => {
                const value = event.target.value
                configureSession({
                  kind: config.kind,
                  lapLimit: value === '' ? null : Number(value),
                })
              }}
              className='w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-red-300/40'
              placeholder='Unlimited'
            />
          </label>

          <label className='space-y-2'>
            <span className='text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45'>
              Grid Size
            </span>
            <select
              value={config.gridSize}
              onChange={event =>
                configureSession({ kind: config.kind, gridSize: Number(event.target.value) })
              }
              className='w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-red-300/40'
            >
              {[1, 6, 10, 16, 20].map(size => (
                <option key={size} value={size} className='bg-[#0b0d12]'>
                  {size} cars
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className='mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3'>
          <div>
            <div className='text-sm font-medium text-white'>Debug Tools</div>
            <div className='text-xs text-white/45'>
              Enables test-only overlays, engineering toggles, and free-camera tooling.
            </div>
          </div>
          <button
            onClick={() =>
              configureSession({ kind: config.kind, testingMode: !config.testingMode })
            }
            className={`h-7 w-12 rounded-full transition ${
              config.testingMode ? 'bg-red-500/70' : 'bg-white/15'
            }`}
          >
            <span
              className={`block h-5 w-5 rounded-full bg-white transition ${
                config.testingMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className='mt-8 flex flex-col gap-3 md:flex-row md:justify-end'>
          <button
            onClick={enterMenu}
            className='rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/10 hover:text-white'
          >
            Back
          </button>
          <button
            onClick={handleStart}
            className='rounded-full border border-red-300/40 bg-red-500/15 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-red-50 transition hover:bg-red-500/25'
          >
            Start Session
          </button>
        </div>
      </Surface>
    </div>
  )
}
