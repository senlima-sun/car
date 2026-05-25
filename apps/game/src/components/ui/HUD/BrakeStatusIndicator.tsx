import { useCarStore } from '../../../stores/useCarStore'

/**
 * Minimal HUD signal for brake-system state.
 *
 *   LOCK  — any wheel is locked under braking (physics-engine `is_locked`
 *           label, ungated by visual smoke/flat-spots for now).
 *   ABS   — anti-lock braking is active. F1-spec sims keep this off; arcade
 *           setups can flip it. Mirrors `BrakeState.abs_enabled`.
 *
 * Placement and styling are intentionally small/unobtrusive — the goal is
 * to prove the data is reaching the UI end-to-end. Future iterations can
 * promote this into tire smoke, audio cues, or a flat-spot wear meter.
 */
export function BrakeStatusIndicator() {
  const wheelLocked = useCarStore(state => state.wheelLocked)
  const absEnabled = useCarStore(state => state.absEnabled)
  const anyLocked = wheelLocked[0] || wheelLocked[1] || wheelLocked[2] || wheelLocked[3]

  return (
    <div className='flex flex-col gap-1 font-mono text-xs uppercase tracking-wider'>
      <div
        className={`px-2 py-1 rounded-md border ${
          anyLocked
            ? 'border-red-500 bg-red-500/20 text-red-300'
            : 'border-white/10 bg-white/[0.04] text-white/30'
        }`}
      >
        LOCK
      </div>
      <div
        className={`px-2 py-1 rounded-md border ${
          absEnabled
            ? 'border-emerald-400 bg-emerald-400/20 text-emerald-200'
            : 'border-white/10 bg-white/[0.04] text-white/30'
        }`}
      >
        ABS
      </div>
    </div>
  )
}
