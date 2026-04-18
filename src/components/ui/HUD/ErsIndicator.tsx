import { useErsStore } from '../../../stores/useErsStore'
import type { HarvestSource } from '../../../wasm/PhysicsBridge'

function batteryColor(charge: number): string {
  if (charge > 50) return '#22c55e'
  if (charge > 20) return '#f59e0b'
  return '#ef4444'
}

function modeMeta(mode: string): { abbrev: string; color: string } {
  switch (mode) {
    case 'Attack':
      return { abbrev: 'ATK', color: '#22c55e' }
    case 'Harvest':
      return { abbrev: 'HRV', color: '#60a5fa' }
    case 'Overtake':
      return { abbrev: 'OVT', color: '#f97316' }
    case 'SemiAuto':
      return { abbrev: 'AUTO', color: '#b388ff' }
    default:
      return { abbrev: 'BAL', color: '#ffffff' }
  }
}

function harvestMeta(source: HarvestSource): { abbrev: string; color: string } {
  switch (source) {
    case 'Braking':
      return { abbrev: 'BRK', color: '#ef4444' }
    case 'Coast':
      return { abbrev: 'CST', color: '#60a5fa' }
    case 'SuperClip':
      return { abbrev: 'CLIP', color: '#b388ff' }
    default:
      return { abbrev: '—', color: 'rgba(255,255,255,0.35)' }
  }
}

export default function ErsIndicator() {
  const batteryCharge = useErsStore(s => s.batteryCharge)
  const mode = useErsStore(s => s.mode)
  const powerFlow = useErsStore(s => s.powerFlow)
  const isDeploying = useErsStore(s => s.isDeploying)
  const isHarvesting = useErsStore(s => s.isHarvesting)
  const superClipActive = useErsStore(s => s.superClipActive)
  const harvestSource = useErsStore(s => s.harvestSource)

  const batteryPercent = Math.max(0, Math.min(100, batteryCharge))
  const batteryTone = batteryColor(batteryPercent)
  const modeInfo = modeMeta(mode)
  const harvestInfo = harvestMeta(harvestSource)

  let flowGlyph = '·'
  let flowColor = 'rgba(255,255,255,0.35)'
  if (isDeploying && isHarvesting) {
    flowGlyph = '⇅'
    flowColor = '#b388ff'
  } else if (isDeploying) {
    flowGlyph = '▲'
    flowColor = '#22c55e'
  } else if (isHarvesting) {
    flowGlyph = '▼'
    flowColor = '#60a5fa'
  }

  return (
    <div
      className='relative flex items-stretch gap-3 border border-white/10 bg-gradient-to-b from-black/85 to-black/70 px-3 py-2 backdrop-blur-md shadow-[0_10px_28px_rgba(0,0,0,0.45)]'
      style={{
        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px)',
      }}
    >
      <div
        className='absolute left-0 top-0 h-full w-[3px]'
        style={{ background: modeInfo.color, boxShadow: `0 0 10px ${modeInfo.color}55` }}
      />

      <div className='flex flex-col items-center gap-1 pl-1'>
        <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>Battery</span>
        <div className='relative h-14 w-5 overflow-hidden border border-white/15 bg-white/5' style={{ borderRadius: 2 }}>
          <div
            className='absolute inset-x-0 bottom-0 transition-[height,background-color] duration-300'
            style={{
              height: `${batteryPercent}%`,
              background: `linear-gradient(to top, ${batteryTone}aa, ${batteryTone})`,
            }}
          />
          <div className='absolute inset-x-0 top-0 flex items-center justify-center pt-1 font-mono text-[9px] font-bold tabular-nums text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]'>
            {Math.round(batteryPercent)}
          </div>
        </div>
      </div>

      <div className='w-px self-stretch bg-white/10' />

      <div className='flex flex-col items-center gap-1'>
        <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>Mode</span>
        <span
          className='font-mono text-[13px] font-bold tabular-nums'
          style={{ color: modeInfo.color }}
        >
          {modeInfo.abbrev}
        </span>
      </div>

      <div className='w-px self-stretch bg-white/10' />

      <div className='flex flex-col items-center gap-1'>
        <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>Flow</span>
        <span
          className='font-mono text-[12px] font-bold leading-none tabular-nums'
          style={{ color: flowColor }}
        >
          {flowGlyph}
        </span>
        <span className='font-mono text-[10px] font-semibold tabular-nums' style={{ color: flowColor }}>
          {Math.abs(Math.round(powerFlow))}
          <span className='text-white/35'>kW</span>
        </span>
      </div>

      <div className='w-px self-stretch bg-white/10' />

      <div className='flex flex-col items-center gap-1'>
        <span className='text-[8px] font-bold uppercase tracking-[0.28em] text-white/45'>Regen</span>
        <span
          className='font-mono text-[11px] font-bold tabular-nums'
          style={{ color: harvestInfo.color }}
        >
          {harvestInfo.abbrev}
        </span>
        <span
          className='h-1.5 w-1.5 rounded-full'
          style={{
            background: superClipActive ? '#b388ff' : 'rgba(255,255,255,0.1)',
            boxShadow: superClipActive ? '0 0 8px #b388ff' : 'none',
            animation: superClipActive ? 'hud-pulse 0.5s ease-in-out infinite' : undefined,
          }}
        />
      </div>
    </div>
  )
}
