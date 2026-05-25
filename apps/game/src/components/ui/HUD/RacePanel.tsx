import { useCarStore } from '../../../stores/useCarStore'
import { useActiveAeroStore } from '../../../stores/useActiveAeroStore'
import { useErsStore } from '../../../stores/useErsStore'
import { AccentBar, Divider, LabelTag, Surface } from '../primitives'
import {
  HUD_ACCENT,
  HUD_DISPLAY_DIGIT_CLASS,
  HUD_NUMERIC_CLASS,
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

function ersFlowMeta(isDeploying: boolean, isHarvesting: boolean) {
  if (isDeploying && isHarvesting) return { glyph: '⇅', color: '#22c55e' }
  if (isDeploying) return { glyph: '▲', color: '#22c55e' }
  if (isHarvesting) return { glyph: '▼', color: '#60a5fa' }
  return { glyph: '·', color: 'rgba(255,255,255,0.35)' }
}

function Stack({
  label,
  align = 'center',
  children,
}: {
  label: string
  align?: 'start' | 'center' | 'end'
  children: React.ReactNode
}) {
  const alignClass =
    align === 'start' ? 'items-start' : align === 'end' ? 'items-end' : 'items-center'
  return (
    <div className={`flex flex-col gap-0.5 ${alignClass}`}>
      <LabelTag>{label}</LabelTag>
      {children}
    </div>
  )
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
  const ersFlow = ersFlowMeta(ersIsDeploying, ersIsHarvesting)

  const gearColor =
    gear === -1 ? HUD_ACCENT.reverse : rpmPercent > 0.95 ? HUD_ACCENT.limiter : HUD_ACCENT.gear

  return (
    <div className='relative flex flex-col items-stretch gap-1 select-none'>
      <div className='flex items-center justify-center gap-[3px] px-3'>
        {Array.from({ length: RPM_LIGHT_COUNT }).map((_, i) => (
          <div
            key={i}
            className='h-2.5 w-4 rounded-[1px]'
            style={{
              backgroundColor: rpmLightColor(i, litLights),
              boxShadow: i < litLights ? `0 0 8px ${rpmLightColor(i, litLights)}` : 'none',
              transition: 'background-color 40ms linear',
            }}
          />
        ))}
      </div>

      <Surface variant='card' className='relative flex items-stretch'>
        <AccentBar color={HUD_ACCENT.speed} />
        <div className='flex items-center gap-3 px-3 py-1.5 pl-4'>
          <Stack label='Aero'>
            <span className={`${HUD_NUMERIC_CLASS} text-[13px]`} style={{ color: aero.color }}>
              {aero.label}
            </span>
          </Stack>
        </div>

        <Divider orientation='vertical' className='self-stretch' />

        <div className='flex items-center gap-3 px-3 py-1.5'>
          <Stack label='Gear'>
            <span
              className={`${HUD_DISPLAY_DIGIT_CLASS} text-[28px]`}
              style={{
                color: gearColor,
                textShadow:
                  rpmPercent > 0.9
                    ? '0 0 10px rgba(255,41,41,0.7)'
                    : '0 0 8px rgba(255,255,255,0.12)',
                minWidth: '20px',
                textAlign: 'center',
              }}
            >
              {displayGear}
            </span>
          </Stack>

          <Stack label='Speed' align='end'>
            <div className='flex items-baseline gap-1'>
              <span
                className={`${HUD_DISPLAY_DIGIT_CLASS} text-[40px] text-white`}
                style={{
                  textShadow: '0 0 18px rgba(0,229,255,0.25)',
                  minWidth: '70px',
                  textAlign: 'right',
                }}
              >
                {displaySpeed.toString().padStart(3, ' ')}
              </span>
              <LabelTag>km/h</LabelTag>
            </div>
          </Stack>

          <Stack label='RPM' align='end'>
            <div className='flex items-baseline gap-1'>
              <span
                className={`${HUD_DISPLAY_DIGIT_CLASS} text-[28px]`}
                style={{
                  color: rpmDigitColor,
                  animation: rpmAnimation,
                  textShadow:
                    rpmZoneName === 'limiter'
                      ? '0 0 12px rgba(255,41,41,0.7)'
                      : rpmZoneName === 'red'
                        ? '0 0 8px rgba(239,68,68,0.4)'
                        : 'none',
                  minWidth: '68px',
                  textAlign: 'right',
                }}
              >
                {displayRpm.toString().padStart(5, ' ')}
              </span>
              <LabelTag>rpm</LabelTag>
            </div>
          </Stack>
        </div>

        <Divider orientation='vertical' className='self-stretch' />

        <div className='flex items-center gap-2 px-3 py-1.5'>
          <Stack label='ERS'>
            <div className='flex items-center gap-1.5'>
              <div
                className='relative h-7 w-3 overflow-hidden rounded-[2px] border border-white/15 bg-white/5'
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
              </div>
              <div className='flex flex-col items-start gap-0'>
                <span className={`${HUD_NUMERIC_CLASS} text-[13px] text-white leading-tight`}>
                  {Math.round(batteryPercent)}
                  <span className='text-white/40'>%</span>
                </span>
                <span className='flex items-center gap-0.5 text-[9px] font-semibold leading-tight'>
                  <span style={{ color: ersFlow.color }}>{ersFlow.glyph}</span>
                  <span style={{ color: preset.color }}>{preset.label}</span>
                </span>
              </div>
            </div>
          </Stack>
        </div>
      </Surface>
    </div>
  )
}
