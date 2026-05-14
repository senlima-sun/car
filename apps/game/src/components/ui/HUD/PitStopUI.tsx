import { usePitStore } from '../../../stores/usePitStore'
import { selectAverageWear, useTireStore } from '../../../stores/useTireStore'
import { useCarStore } from '../../../stores/useCarStore'
import { TIRE_CONFIG, TIRE_ORDER } from '../../../constants/tires'
import { getErsBatteryCharge, setErsBatteryCharge } from '../../../wasm/PhysicsBridge'

function ersBarColor(charge: number): string {
  if (charge > 0.5) return '#22c55e'
  if (charge > 0.2) return '#f59e0b'
  return '#ef4444'
}

const BROADCAST_CLIP = 'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%, 0 14px)'

export default function PitStopUI() {
  const isPitStopActive = usePitStore(s => s.isPitStopActive)
  const selectedNewTire = usePitStore(s => s.selectedNewTire)
  const ersChargeSelected = usePitStore(s => s.ersChargeSelected)
  const pitStopSpeedThreshold = usePitStore(s => s.pitStopSpeedThreshold)
  const selectTire = usePitStore(s => s.selectTire)
  const toggleErsCharge = usePitStore(s => s.toggleErsCharge)
  const completePitStop = usePitStore(s => s.completePitStop)
  const cancelPitStop = usePitStore(s => s.cancelPitStop)

  const currentCompound = useTireStore(s => s.currentCompound)
  const averageWear = useTireStore(selectAverageWear)
  const setTireCompound = useTireStore(s => s.setTireCompound)
  const resetWear = useTireStore(s => s.resetWear)

  const speed = useCarStore(s => s.speed)
  const speedMs = speed / 3.6

  if (!isPitStopActive) return null

  let currentErsCharge = 0
  try {
    currentErsCharge = getErsBatteryCharge()
  } catch {
    currentErsCharge = 0
  }

  const ersPercent = Math.round(currentErsCharge * 100)
  const canPerformPitStop = speedMs < pitStopSpeedThreshold
  const hasSelection = selectedNewTire || ersChargeSelected
  const canConfirm = canPerformPitStop && hasSelection

  const handleConfirm = () => {
    if (!canConfirm) return
    const result = completePitStop()
    if (result.tire) {
      setTireCompound(result.tire)
      resetWear()
    }
    if (result.ersCharge) {
      setErsBatteryCharge(1.0)
    }
  }

  const currentConfig = TIRE_CONFIG[currentCompound]
  const selectedConfig = selectedNewTire ? TIRE_CONFIG[selectedNewTire] : null

  return (
    <div className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto'>
      <div
        className='relative flex w-[480px] flex-col gap-5 border border-[#ffcc00]/40 bg-gradient-to-b from-black/90 via-black/85 to-black/90 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.7)]'
        style={{ clipPath: BROADCAST_CLIP }}
      >
        <div className='absolute inset-x-5 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#ffcc00] to-transparent' />

        <div className='flex items-baseline justify-between'>
          <div>
            <div className='text-[9px] font-bold uppercase tracking-[0.42em] text-[#ffcc00]'>
              Service Menu
            </div>
            <div className='mt-1 font-sans text-[24px] font-bold uppercase tracking-[0.22em] text-white'>
              Pit Stop
            </div>
          </div>
          <span className='font-mono text-[10px] font-semibold uppercase tracking-[0.32em] text-white/40'>
            ESC to cancel
          </span>
        </div>

        {!canPerformPitStop && (
          <div
            className='border border-red-500/50 bg-red-950/50 px-4 py-2 text-center font-sans text-[11px] font-bold uppercase tracking-[0.32em] text-[#ff8b8b] backdrop-blur-sm'
            style={{ clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)' }}
          >
            Stop the car to perform pit stop
          </div>
        )}

        <div
          className='flex items-center justify-between border border-white/10 bg-white/[0.03] px-4 py-2'
          style={{ clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)' }}
        >
          <div className='flex flex-col'>
            <span className='text-[8px] font-bold uppercase tracking-[0.32em] text-white/45'>
              Current
            </span>
            <div className='mt-1 flex items-center gap-2'>
              <div
                className='flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-black'
                style={{ background: currentConfig.color }}
              >
                {currentConfig.icon}
              </div>
              <span className='font-sans text-[12px] font-bold uppercase tracking-[0.2em] text-white'>
                {currentConfig.displayName}
              </span>
              <span className='font-mono text-[11px] tabular-nums text-white/60'>
                {Math.round(100 - averageWear)}% life
              </span>
            </div>
          </div>
          {selectedConfig && (
            <div className='flex flex-col items-end'>
              <span className='text-[8px] font-bold uppercase tracking-[0.32em] text-[#ffcc00]'>
                New
              </span>
              <div className='mt-1 flex items-center gap-2'>
                <span className='font-sans text-[12px] font-bold uppercase tracking-[0.2em] text-white'>
                  {selectedConfig.displayName}
                </span>
                <div
                  className='flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-black'
                  style={{ background: selectedConfig.color }}
                >
                  {selectedConfig.icon}
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className='mb-2 text-[8px] font-bold uppercase tracking-[0.32em] text-white/45'>
            Tires
          </div>
          <div className='grid grid-cols-5 gap-2'>
            {TIRE_ORDER.map(compound => {
              const cfg = TIRE_CONFIG[compound]
              const isSelected = selectedNewTire === compound
              return (
                <button
                  key={compound}
                  type='button'
                  className='flex flex-col items-center gap-1.5 border bg-white/[0.03] px-2 py-3 transition-all hover:bg-white/[0.08] active:scale-[0.98]'
                  onClick={() => selectTire(compound)}
                  style={{
                    borderColor: isSelected ? cfg.color : 'rgba(255,255,255,0.1)',
                    boxShadow: isSelected
                      ? `0 0 0 1px ${cfg.color}80, 0 0 18px ${cfg.color}40`
                      : 'none',
                    clipPath: 'polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px)',
                  }}
                >
                  <div
                    className='flex h-9 w-9 items-center justify-center rounded-full text-[16px] font-bold text-black'
                    style={{
                      background: cfg.color,
                      boxShadow: isSelected ? `0 0 12px ${cfg.color}` : 'none',
                    }}
                  >
                    {cfg.icon}
                  </div>
                  <span className='font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-white'>
                    {cfg.displayName}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div
          className='border border-white/10 bg-white/[0.03] px-4 py-3'
          style={{ clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)' }}
        >
          <div className='flex items-baseline justify-between'>
            <span className='text-[8px] font-bold uppercase tracking-[0.32em] text-[#ffcc00]'>
              Energy Recovery System
            </span>
            <span className='font-mono text-[12px] font-semibold tabular-nums text-white'>
              {ersPercent}%
            </span>
          </div>
          <div className='mt-2 h-1.5 overflow-hidden bg-white/10'>
            <div
              className='h-full transition-[width]'
              style={{ width: `${ersPercent}%`, background: ersBarColor(currentErsCharge) }}
            />
          </div>
          <button
            type='button'
            onClick={toggleErsCharge}
            className='mt-3 w-full border px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.28em] transition-all'
            style={{
              borderColor: ersChargeSelected ? '#ffcc00' : 'rgba(255,255,255,0.12)',
              background: ersChargeSelected ? 'rgba(255,204,0,0.14)' : 'rgba(255,255,255,0.04)',
              color: ersChargeSelected ? '#ffcc00' : 'rgba(255,255,255,0.7)',
              clipPath: 'polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px)',
            }}
          >
            {ersChargeSelected ? 'Charge to 100% — Selected' : 'Charge ERS to 100%'}
          </button>
        </div>

        {hasSelection && (
          <div
            className='border border-white/10 bg-white/[0.03] px-4 py-2'
            style={{ clipPath: 'polygon(6px 0, 100% 0, 100% 100%, 0 100%, 0 6px)' }}
          >
            <div className='text-[8px] font-bold uppercase tracking-[0.32em] text-white/45'>
              Summary
            </div>
            {selectedConfig && (
              <div className='mt-1 flex items-center gap-2 font-sans text-[12px] text-white'>
                <span style={{ color: selectedConfig.color }}>●</span>
                <span className='uppercase tracking-[0.14em]'>{selectedConfig.displayName}</span>
              </div>
            )}
            {ersChargeSelected && (
              <div className='mt-0.5 font-mono text-[11px] tabular-nums text-white/85'>
                ERS {ersPercent}% → 100%
              </div>
            )}
          </div>
        )}

        <div className='flex gap-3'>
          <button
            type='button'
            onClick={cancelPitStop}
            className='flex-1 border border-white/20 bg-white/[0.03] px-4 py-2.5 font-sans text-[12px] font-bold uppercase tracking-[0.28em] text-white/70 transition hover:bg-white/[0.08]'
            style={{ clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)' }}
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={!canConfirm}
            className='flex-[2] border px-4 py-2.5 font-sans text-[13px] font-bold uppercase tracking-[0.28em] transition disabled:cursor-not-allowed'
            style={{
              borderColor: canConfirm ? '#22c55e' : 'rgba(255,255,255,0.08)',
              background: canConfirm
                ? 'linear-gradient(to bottom, rgba(34,197,94,0.2), rgba(0,0,0,0.4))'
                : 'rgba(255,255,255,0.03)',
              color: canConfirm ? '#bef5c8' : 'rgba(255,255,255,0.35)',
              boxShadow: canConfirm ? '0 0 24px rgba(34,197,94,0.25)' : 'none',
              clipPath: 'polygon(8px 0, 100% 0, 100% 100%, 0 100%, 0 8px)',
            }}
          >
            Confirm Pit Stop
          </button>
        </div>
      </div>
    </div>
  )
}
