import { useCarStore } from '../../../stores/useCarStore'

const GEAR_LABEL: Record<number, string> = {
  [-1]: 'R',
  0: 'N',
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
}

const MAX_RPM = 15000
const RPM_LIGHTS = 12

function rpmLightColor(index: number, litCount: number): string {
  if (index >= litCount) return 'rgba(255,255,255,0.06)'
  if (index < 6) return '#22c55e'
  if (index < 10) return '#f59e0b'
  return '#ef4444'
}

export default function GearIndicator() {
  const gear = useCarStore(s => s.gear)
  const rpm = useCarStore(s => s.rpm)
  const displayGear = GEAR_LABEL[gear] ?? gear.toString()
  const rpmPercent = Math.min(rpm / MAX_RPM, 1)
  const litLights = Math.round(rpmPercent * RPM_LIGHTS)
  const redline = rpmPercent >= 0.95
  const gearColor = gear === -1 ? '#ff9f43' : redline ? '#ff2929' : '#ffffff'

  return (
    <div
      className='relative flex flex-col items-center gap-1 border border-white/10 bg-gradient-to-b from-black/85 to-black/70 px-5 py-2.5 backdrop-blur-md shadow-[0_10px_28px_rgba(0,0,0,0.45)]'
      style={{
        clipPath: 'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%, 0 8px)',
        minWidth: 110,
      }}
    >
      <div className='flex items-center gap-[2px]'>
        {Array.from({ length: RPM_LIGHTS }).map((_, i) => (
          <div
            key={i}
            className='h-1 w-2 rounded-[1px]'
            style={{
              background: rpmLightColor(i, litLights),
              boxShadow: i < litLights ? `0 0 4px ${rpmLightColor(i, litLights)}` : 'none',
            }}
          />
        ))}
      </div>

      <div className='text-[8px] font-bold uppercase tracking-[0.32em] text-white/45'>Gear</div>

      <span
        className='font-mono text-[52px] font-bold leading-none tabular-nums'
        style={{
          color: gearColor,
          textShadow: redline ? '0 0 16px rgba(255,41,41,0.7)' : '0 0 14px rgba(255,255,255,0.12)',
        }}
      >
        {displayGear}
      </span>

      <div className='mt-1 flex w-full items-center gap-2'>
        <div className='relative h-1 flex-1 overflow-hidden bg-white/10'>
          <div
            className='h-full transition-[width,background-color]'
            style={{
              width: `${rpmPercent * 100}%`,
              background: redline ? '#ef4444' : rpmPercent > 0.8 ? '#f97316' : '#22c55e',
            }}
          />
        </div>
        <span className='font-mono text-[10px] font-semibold tabular-nums text-white/85'>
          {Math.round(rpm / 1000)}
          <span className='text-white/35'>K</span>
        </span>
      </div>
    </div>
  )
}
