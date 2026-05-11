import { useCarStore } from '../../../stores/useCarStore'
import { useActiveAeroStore } from '../../../stores/useActiveAeroStore'
import { useErsStore } from '../../../stores/useErsStore'
import {
  HUD_ACCENT,
  HUD_DISPLAY_DIGIT_CLASS,
  HUD_MICRO_LABEL_CLASS,
  HUD_NUMERIC_CLASS,
  HudCell,
  HudPanel,
  HudVerticalDivider,
  RPM_LIGHT_COUNT,
  litLights as litLightsForRpm,
  rpmDigitAnimation,
  rpmLightColor,
  rpmPercent as rpmPercentForRpm,
  rpmZone,
  rpmZoneColor,
} from './hudChrome'

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

export default function RacePanel() {
  const gear = useCarStore(s => s.gear)
  const speed = useCarStore(s => s.speed)
  const rpm = useCarStore(s => s.rpm)

  const aeroMode = useActiveAeroStore(s => s.mode)

  const batteryCharge = useErsStore(s => s.batteryCharge)
  const semiAutoConfig = useErsStore(s => s.semiAutoConfig)
  const ersIsDeploying = useErsStore(s => s.isDeploying)
  const ersIsHarvesting = useErsStore(s => s.isHarvesting)

  const displayGear = GEAR_LABEL[gear] ?? gear.toString()
  const displaySpeed = Math.round(Math.abs(speed))
  const rpmPercent = rpmPercentForRpm(rpm)
  const litLights = litLightsForRpm(rpm)
  const rpmZoneName = rpmZone(litLights)
  const rpmDigitColor = rpmZoneColor(rpmZoneName)
  const rpmAnimation = rpmDigitAnimation(litLights)
  const displayRpm = Math.round(rpm)

  const aero = aeroMeta(aeroMode)
  const preset = ersPresetMeta(semiAutoConfig.preset)
  const batteryPercent = Math.max(0, Math.min(100, batteryCharge))

  const ersFlow =
    ersIsDeploying && ersIsHarvesting ? '⇅' : ersIsDeploying ? '▲' : ersIsHarvesting ? '▼' : '·'
  const ersFlowColor = ersIsDeploying
    ? '#22c55e'
    : ersIsHarvesting
      ? '#60a5fa'
      : 'rgba(255,255,255,0.35)'

  const gearColor =
    gear === -1 ? HUD_ACCENT.reverse : rpmPercent > 0.95 ? HUD_ACCENT.limiter : HUD_ACCENT.gear

  return (
    <div className='relative flex flex-col items-stretch gap-0 select-none'>
      <div className='flex items-center justify-center gap-[3px] px-2'>
        {Array.from({ length: RPM_LIGHT_COUNT }).map((_, i) => (
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

      <HudPanel accent={HUD_ACCENT.speed} className='mt-1' contentClassName='flex flex-col'>
        <div className='flex items-stretch gap-0'>
          <div className='flex items-center gap-5 px-5 py-2'>
            <div
              className='relative flex h-16 w-14 items-center justify-center border border-white/15'
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
                className={`${HUD_DISPLAY_DIGIT_CLASS} text-[42px]`}
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
              <span className={`${HUD_MICRO_LABEL_CLASS} absolute bottom-1 right-1.5`}>GEAR</span>
            </div>

            <div className='flex items-baseline gap-1.5'>
              <span
                className={`${HUD_DISPLAY_DIGIT_CLASS} text-[54px] text-white`}
                style={{
                  textShadow: '0 0 24px rgba(0,229,255,0.2)',
                  minWidth: '92px',
                  textAlign: 'right',
                }}
              >
                {displaySpeed.toString().padStart(3, ' ')}
              </span>
              <span className='flex flex-col text-[9px] font-semibold uppercase tracking-[0.28em] text-white/45'>
                <span>km</span>
                <span>/h</span>
              </span>
            </div>

            <div className='flex items-baseline gap-1.5'>
              <span
                className={`${HUD_DISPLAY_DIGIT_CLASS} text-[34px]`}
                style={{
                  color: rpmDigitColor,
                  animation: rpmAnimation,
                  textShadow:
                    rpmZoneName === 'limiter'
                      ? '0 0 14px rgba(255,41,41,0.7)'
                      : rpmZoneName === 'red'
                        ? '0 0 10px rgba(239,68,68,0.4)'
                        : 'none',
                  minWidth: '88px',
                  textAlign: 'right',
                }}
              >
                {displayRpm.toString().padStart(5, ' ')}
              </span>
              <span className='flex flex-col text-[9px] font-semibold uppercase tracking-[0.28em] text-white/45'>
                <span>r</span>
                <span>pm</span>
              </span>
            </div>
          </div>
        </div>

        <div className='flex items-stretch border-t border-white/10'>
          <div className='flex items-center gap-4 px-4 py-2'>
            <HudCell label='Aero'>
              <span
                className={`${HUD_NUMERIC_CLASS} text-base`}
                style={{ color: aero.color }}
              >
                {aero.label}
              </span>
            </HudCell>

            <HudVerticalDivider size='md' />

            <HudCell label='ERS'>
              <div className='flex items-center gap-2'>
                <div
                  className='relative h-8 w-4 overflow-hidden rounded-[2px] border border-white/15 bg-white/5'
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
                      background: `linear-gradient(to top, #6d3eff, ${HUD_ACCENT.battery})`,
                      boxShadow: '0 0 6px rgba(179,136,255,0.5)',
                    }}
                  />
                  <div
                    className='absolute inset-x-0 h-px'
                    style={{ bottom: `${semiAutoConfig.targetMin}%`, background: HUD_ACCENT.battery }}
                  />
                  <div
                    className='absolute inset-x-0 h-px'
                    style={{ bottom: `${semiAutoConfig.targetMax}%`, background: HUD_ACCENT.battery }}
                  />
                </div>
                <div className='flex flex-col items-start gap-0.5'>
                  <span className={`${HUD_NUMERIC_CLASS} text-[13px] text-white`}>
                    {Math.round(batteryPercent)}
                    <span className='text-white/40'>%</span>
                  </span>
                  <span className='flex items-center gap-1 text-[10px] font-semibold'>
                    <span style={{ color: ersFlowColor }}>{ersFlow}</span>
                    <span style={{ color: preset.color }}>{preset.label}</span>
                  </span>
                </div>
              </div>
            </HudCell>
          </div>
        </div>
      </HudPanel>
    </div>
  )
}
