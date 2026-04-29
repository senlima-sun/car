import { useCarStore } from '../../../stores/useCarStore'
import { useActiveAeroStore } from '../../../stores/useActiveAeroStore'
import { useErsStore } from '../../../stores/useErsStore'
import { selectAverageWear, useTireStore } from '../../../stores/useTireStore'
import { useBrakeStore } from '../../../stores/useBrakeStore'
import { TIRE_CONFIG, TIRE_WEAR_WARNING, TIRE_WEAR_CRITICAL } from '../../../constants/tires'
import { HUD_DIVIDER_CLASS, HUD_LABEL_CLASS, HudPanel } from './hudChrome'

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
const RPM_LIGHTS = 15

function aeroMeta(mode: string) {
  if (mode === 'Corner') return { label: 'CRN', color: '#00e5ff' }
  return { label: 'STR', color: '#22c55e' }
}

function ersPresetMeta(preset: string) {
  switch (preset) {
    case 'Aggressive':
      return { label: 'AGR', color: '#ef4444' }
    case 'Conservative':
      return { label: 'CON', color: '#60a5fa' }
    default:
      return { label: 'BAL', color: '#f59e0b' }
  }
}

function wearColor(wear: number) {
  if (wear >= TIRE_WEAR_CRITICAL) return '#ef4444'
  if (wear >= TIRE_WEAR_WARNING) return '#f59e0b'
  return '#22c55e'
}

function engineBrakeMeta(level: string) {
  switch (level) {
    case 'Low':
      return { abbrev: 'L', color: '#60a5fa' }
    case 'High':
      return { abbrev: 'H', color: '#f97316' }
    default:
      return { abbrev: 'M', color: '#22c55e' }
  }
}

function rpmLightColor(index: number, litCount: number) {
  if (index >= litCount) return 'rgba(255,255,255,0.06)'
  if (index < 7) return '#22c55e'
  if (index < 12) return '#f59e0b'
  return '#ef4444'
}

export default function RacePanel() {
  const gear = useCarStore(s => s.gear)
  const speed = useCarStore(s => s.speed)
  const rpm = useCarStore(s => s.rpm)

  const aeroMode = useActiveAeroStore(s => s.mode)

  const batteryCharge = useErsStore(s => s.batteryCharge)
  const semiAutoConfig = useErsStore(s => s.semiAutoConfig)
  const ersIsDeploying = useErsStore(s => s.isDeploying)
  const ersIsHarvesting = useErsStore(s => s.isHarvesting)

  const currentCompound = useTireStore(s => s.currentCompound)
  const averageWear = useTireStore(selectAverageWear)

  const frontBias = useBrakeStore(s => s.frontBias)
  const engineBraking = useBrakeStore(s => s.engineBraking)

  const displayGear = GEAR_LABEL[gear] ?? gear.toString()
  const displaySpeed = Math.round(Math.abs(speed))
  const rpmPercent = Math.min(1, rpm / MAX_RPM)
  const litLights = Math.round(rpmPercent * RPM_LIGHTS)
  const aero = aeroMeta(aeroMode)
  const preset = ersPresetMeta(semiAutoConfig.preset)
  const tireConfig = TIRE_CONFIG[currentCompound]
  const tireLife = Math.max(0, 100 - averageWear)
  const tireTone = wearColor(averageWear)
  const batteryPercent = Math.max(0, Math.min(100, batteryCharge))
  const rearBias = 100 - frontBias
  const eb = engineBrakeMeta(engineBraking)

  const ersFlow =
    ersIsDeploying && ersIsHarvesting ? '⇅' : ersIsDeploying ? '▲' : ersIsHarvesting ? '▼' : '·'
  const ersFlowColor = ersIsDeploying
    ? '#22c55e'
    : ersIsHarvesting
      ? '#60a5fa'
      : 'rgba(255,255,255,0.35)'

  const gearColor = gear === -1 ? '#ff9f43' : rpmPercent > 0.95 ? '#ff2929' : '#ffffff'

  return (
    <div className='relative flex flex-col items-stretch gap-0 select-none'>
      <div className='flex items-center justify-center gap-[3px] px-2'>
        {Array.from({ length: RPM_LIGHTS }).map((_, i) => (
          <div
            key={i}
            className='h-1.5 w-3 rounded-[1px]'
            style={{
              backgroundColor: rpmLightColor(i, litLights),
              boxShadow: i < litLights ? `0 0 6px ${rpmLightColor(i, litLights)}` : 'none',
              transition: 'background-color 40ms linear',
            }}
          />
        ))}
      </div>

      <HudPanel accent='#00e5ff' className='mt-1' contentClassName='flex items-stretch gap-0'>
        <div className='flex items-center gap-4 px-4 py-2.5'>
          <Cell label='Aero'>
            <div className='flex items-baseline gap-1.5'>
              <span
                className='font-mono text-base font-semibold tabular-nums'
                style={{ color: aero.color }}
              >
                {aero.label}
              </span>
            </div>
          </Cell>

          <div className={`h-10 ${HUD_DIVIDER_CLASS}`} />

          <Cell label='ERS'>
            <div className='flex items-center gap-2'>
              <div
                className='relative h-10 w-4 overflow-hidden rounded-[2px] border border-white/15 bg-white/5'
                aria-label='battery'
              >
                <div
                  className='absolute inset-x-0 bottom-0'
                  style={{
                    height: `${semiAutoConfig.targetMax - semiAutoConfig.targetMin}%`,
                    bottom: `${semiAutoConfig.targetMin}%`,
                    background: 'rgba(179,136,255,0.18)',
                  }}
                />
                <div
                  className='absolute inset-x-0 bottom-0 transition-[height] duration-300'
                  style={{
                    height: `${batteryPercent}%`,
                    background: 'linear-gradient(to top, #6d3eff, #b388ff)',
                    boxShadow: '0 0 6px rgba(179,136,255,0.5)',
                  }}
                />
                <div
                  className='absolute inset-x-0 h-px bg-[#b388ff]'
                  style={{ bottom: `${semiAutoConfig.targetMin}%` }}
                />
                <div
                  className='absolute inset-x-0 h-px bg-[#b388ff]'
                  style={{ bottom: `${semiAutoConfig.targetMax}%` }}
                />
              </div>
              <div className='flex flex-col items-start gap-0.5'>
                <span className='font-mono text-[13px] font-semibold tabular-nums text-white'>
                  {Math.round(batteryPercent)}
                  <span className='text-white/40'>%</span>
                </span>
                <span className='flex items-center gap-1 text-[10px] font-semibold'>
                  <span style={{ color: ersFlowColor }}>{ersFlow}</span>
                  <span style={{ color: preset.color }}>{preset.label}</span>
                </span>
              </div>
            </div>
          </Cell>
        </div>

        <div className={HUD_DIVIDER_CLASS} />

        <div className='flex items-center gap-5 px-6 py-2'>
          <div
            className='relative flex h-16 w-14 items-center justify-center border border-white/15 bg-black/60'
            style={{
              clipPath:
                'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
              background:
                gear === -1
                  ? 'linear-gradient(to bottom, rgba(255,159,67,0.14), rgba(0,0,0,0.6))'
                  : 'linear-gradient(to bottom, rgba(255,255,255,0.07), rgba(0,0,0,0.7))',
            }}
          >
            <span
              className='font-mono text-[42px] font-bold leading-none tabular-nums'
              style={{
                color: gearColor,
                textShadow:
                  rpmPercent > 0.9
                    ? '0 0 12px rgba(255,41,41,0.7)'
                    : '0 0 10px rgba(255,255,255,0.12)',
              }}
            >
              {displayGear}
            </span>
            <span className='absolute bottom-1 right-1.5 font-mono text-[7px] tracking-[0.3em] text-white/35'>
              GEAR
            </span>
          </div>

          <div className='flex items-baseline gap-1.5'>
            <span
              className='font-mono text-[54px] font-bold leading-none tabular-nums text-white'
              style={{
                textShadow: '0 0 24px rgba(0,229,255,0.2)',
                minWidth: '92px',
                textAlign: 'right',
              }}
            >
              {displaySpeed.toString().padStart(3, '\u00A0')}
            </span>
            <span className='flex flex-col text-[9px] font-semibold uppercase tracking-[0.28em] text-white/45'>
              <span>km</span>
              <span>/h</span>
            </span>
          </div>
        </div>

        <div className={HUD_DIVIDER_CLASS} />

        <div className='flex items-center gap-4 px-4 py-2.5'>
          <Cell label='Tire'>
            <div className='flex items-center gap-2'>
              <div
                className='flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-black'
                style={{
                  background: tireConfig.color,
                  boxShadow: `0 0 0 2px rgba(255,255,255,0.12)`,
                }}
              >
                {tireConfig.icon}
              </div>
              <div className='flex flex-col items-start gap-1'>
                <div className='flex items-baseline gap-1'>
                  <span
                    className='font-mono text-[12px] font-semibold tabular-nums'
                    style={{ color: tireTone }}
                  >
                    {Math.round(tireLife)}
                  </span>
                  <span className='text-[8px] uppercase tracking-[0.28em] text-white/35'>
                    %life
                  </span>
                </div>
                <div className='h-1 w-[56px] overflow-hidden rounded-[1px] bg-white/10'>
                  <div
                    className='h-full transition-[width] duration-300'
                    style={{ width: `${tireLife}%`, background: tireTone }}
                  />
                </div>
              </div>
            </div>
          </Cell>

          <div className='h-10 w-px bg-white/10' />

          <Cell label='Brake'>
            <div className='flex flex-col gap-1'>
              <div className='flex items-baseline gap-1 font-mono text-[12px] font-semibold tabular-nums text-white'>
                <span>{Math.round(frontBias)}</span>
                <span className='text-white/35'>:</span>
                <span>{Math.round(rearBias)}</span>
              </div>
              <span
                className='font-mono text-[10px] font-semibold tabular-nums'
                style={{ color: eb.color }}
              >
                EB·{eb.abbrev}
              </span>
            </div>
          </Cell>
        </div>
      </HudPanel>
    </div>
  )
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex flex-col items-start gap-1'>
      <span className={HUD_LABEL_CLASS}>{label}</span>
      {children}
    </div>
  )
}
