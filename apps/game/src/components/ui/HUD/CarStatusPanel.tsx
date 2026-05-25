import { selectAverageWear, useTireStore } from '../../../stores/useTireStore'
import { useTemperatureStore } from '../../../stores/useTemperatureStore'
import { useBrakeStore } from '../../../stores/useBrakeStore'
import { TIRE_CONFIG } from '../../../constants/tires'
import { BRAKE_BIAS, ENGINE_BRAKING } from '../../../constants/colors'
import { engineTempToCelsius, tireTempToCelsius } from '../../../wasm/PhysicsBridge'
import type { EngineBrakingLevel } from '../../../wasm/PhysicsBridge'
import { celsiusToColor } from '../../../utils/temperatureColors'
import { AccentBar, LabelTag, Surface } from '../primitives'
import { HUD_NUMERIC_CLASS, HUD_STATUS, isWearCritical, wearColor } from './hudChrome'

function Cell({
  label,
  align = 'start',
  children,
}: {
  label: string
  align?: 'start' | 'end'
  children: React.ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1 ${align === 'end' ? 'items-end' : 'items-start'}`}>
      <LabelTag>{label}</LabelTag>
      {children}
    </div>
  )
}

function gripColor(g: number): string {
  if (g >= 80) return HUD_STATUS.success
  if (g >= 50) return HUD_STATUS.warning
  return HUD_STATUS.danger
}

function engineTempColor(normalized: number): string {
  if (normalized >= 0.857) return '#dc2626'
  if (normalized >= 0.75) return HUD_STATUS.danger
  if (normalized >= 0.679) return HUD_STATUS.warning
  if (normalized >= 0.286) return HUD_STATUS.success
  return '#60a5fa'
}

export function biasColor(frontBias: number): string {
  if (frontBias > 62) return BRAKE_BIAS.front
  if (frontBias < 58) return BRAKE_BIAS.rear
  return BRAKE_BIAS.balanced
}

const ENGINE_BRAKE_META: Record<EngineBrakingLevel, { abbrev: 'L' | 'M' | 'H'; color: string }> = {
  Low: { abbrev: 'L', color: ENGINE_BRAKING.low },
  Medium: { abbrev: 'M', color: ENGINE_BRAKING.medium },
  High: { abbrev: 'H', color: ENGINE_BRAKING.high },
}

export function engineBrakeMeta(level: EngineBrakingLevel) {
  return ENGINE_BRAKE_META[level]
}

function CombinedWheelCell({
  side,
  wear,
  innerTemp,
  outerTemp,
  inWindow,
  blowoutRisk,
  blown,
  compoundColor,
}: {
  side: 'left' | 'right'
  wear: number
  innerTemp: number
  outerTemp: number
  inWindow: boolean
  blowoutRisk: number
  blown: boolean
  compoundColor: string
}) {
  const remaining = Math.max(0, 100 - wear)
  const wearTone = wearColor(wear)
  const innerC = tireTempToCelsius(innerTemp)
  const outerC = tireTempToCelsius(outerTemp)
  const avgC = Math.round(tireTempToCelsius((innerTemp + outerTemp) / 2))

  const danger = blown || blowoutRisk > 0.4
  const ringColor = blown
    ? HUD_STATUS.danger
    : blowoutRisk > 0.4
      ? HUD_STATUS.warning
      : inWindow
        ? HUD_STATUS.success
        : compoundColor
  const ringGlow = blown
    ? '0 0 14px rgba(239,68,68,0.85)'
    : blowoutRisk > 0.4
      ? `0 0 ${8 + blowoutRisk * 10}px rgba(245,158,11,${0.45 + blowoutRisk * 0.45})`
      : inWindow
        ? '0 0 10px rgba(34,197,94,0.45)'
        : '0 0 8px rgba(255,255,255,0.06)'

  const innerSwatch = celsiusToColor(innerC)
  const outerSwatch = celsiusToColor(outerC)
  const outerDotPosition = side === 'left' ? 'left-1.5' : 'right-1.5'
  const innerDotPosition = side === 'left' ? 'right-1.5' : 'left-1.5'

  return (
    <div
      className='relative flex h-[78px] w-[78px] flex-col items-center justify-center rounded-full border-2 bg-black/55'
      style={{
        borderColor: ringColor,
        boxShadow: ringGlow,
        opacity: blown ? 0.6 : 1,
      }}
    >
      <span
        className={`absolute top-2.5 ${outerDotPosition} h-1.5 w-1.5 rounded-full`}
        style={{ background: outerSwatch, boxShadow: `0 0 4px ${outerSwatch}` }}
        title={`Outer ${Math.round(outerC)}°C`}
      />
      <span
        className={`absolute bottom-2.5 ${outerDotPosition} h-1.5 w-1.5 rounded-full`}
        style={{ background: outerSwatch, opacity: 0.6 }}
      />
      <span
        className={`absolute top-2.5 ${innerDotPosition} h-1.5 w-1.5 rounded-full`}
        style={{ background: innerSwatch, boxShadow: `0 0 4px ${innerSwatch}` }}
        title={`Inner ${Math.round(innerC)}°C`}
      />
      <span
        className={`absolute bottom-2.5 ${innerDotPosition} h-1.5 w-1.5 rounded-full`}
        style={{ background: innerSwatch, opacity: 0.6 }}
      />

      <span
        className={`${HUD_NUMERIC_CLASS} text-[13px] leading-tight`}
        style={{
          color: blown ? HUD_STATUS.danger : danger ? HUD_STATUS.warning : 'rgba(255,255,255,0.95)',
        }}
      >
        {blown ? 'BLN' : `${avgC}°`}
      </span>
      <span
        className={`${HUD_NUMERIC_CLASS} text-[12px] leading-tight`}
        style={{ color: wearTone }}
      >
        {Math.round(remaining)}%
      </span>
    </div>
  )
}

export default function CarStatusPanel() {
  const currentCompound = useTireStore(s => s.currentCompound)
  const perWheelWear = useTireStore(s => s.perWheelWear)
  const averageWear = useTireStore(selectAverageWear)
  const effectiveGrip = useTireStore(s => s.effectiveGripMultiplier)
  const tireMaterial = useTireStore(s => s.tireMaterial)

  const engine = useTemperatureStore(s => s.engine)
  const tires = useTemperatureStore(s => s.tires)
  const tiresInWindow = useTemperatureStore(s => s.tiresInWindow)
  const tireBlowoutRisk = useTemperatureStore(s => s.tireBlowoutRisk)
  const tireBlown = useTemperatureStore(s => s.tireBlown)
  const engineSeizeRisk = useTemperatureStore(s => s.engineSeizeRisk)
  const engineSeized = useTemperatureStore(s => s.engineSeized)

  const frontBias = useBrakeStore(s => s.frontBias)
  const engineBraking = useBrakeStore(s => s.engineBraking)

  const config = TIRE_CONFIG[currentCompound]
  const avgRemaining = Math.max(0, 100 - averageWear)
  const gripPercent = Math.round(effectiveGrip * 100)

  const maxWear = Math.max(
    perWheelWear.frontLeft,
    perWheelWear.frontRight,
    perWheelWear.rearLeft,
    perWheelWear.rearRight,
  )
  const isCritical = isWearCritical(maxWear)

  const maxGraining = tireMaterial ? Math.max(...tireMaterial.per_wheel_graining) : 0
  const maxBlistering = tireMaterial ? Math.max(...tireMaterial.per_wheel_blistering) : 0
  const hasGrainingWarn = maxGraining > 0.3
  const hasBlisteringWarn = maxBlistering > 0.1

  const engineTempC = Math.round(engineTempToCelsius(engine.temperature))
  const powerLoss = Math.round((1 - engine.power_multiplier) * 100)
  const engineColor = engineSeized ? HUD_STATUS.danger : engineTempColor(engine.temperature)
  const engineDanger = engineSeized || engineSeizeRisk > 0.2

  const rearBias = 100 - frontBias
  const biasTone = biasColor(frontBias)
  const eb = engineBrakeMeta(engineBraking)

  return (
    <Surface
      variant='card'
      className='relative min-w-[260px] overflow-hidden pb-2'
      style={{ animation: isCritical ? 'hud-critical 1.1s ease-in-out infinite' : undefined }}
    >
      <AccentBar color={config.color} />
      <div className='flex items-center justify-between border-b border-white/10 px-3 py-1.5'>
        <div className='flex items-center gap-2'>
          <div
            className='flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-black'
            style={{ background: config.color, boxShadow: '0 0 0 2px rgba(255,255,255,0.12)' }}
          >
            {config.icon}
          </div>
          <span className='font-sans text-[11px] font-bold uppercase tracking-[0.24em] text-white'>
            {config.displayName}
          </span>
        </div>
        <Cell label='Grip' align='end'>
          <span
            className={`${HUD_NUMERIC_CLASS} text-[12px]`}
            style={{ color: gripColor(gripPercent) }}
          >
            {gripPercent}%
          </span>
        </Cell>
      </div>

      <div className='relative px-3 py-3'>
        <div
          className='pointer-events-none absolute left-1/2 top-4 bottom-4 w-px -translate-x-1/2'
          style={{
            background:
              'linear-gradient(to bottom, transparent, rgba(255,255,255,0.16) 18%, rgba(255,255,255,0.16) 82%, transparent)',
          }}
        />
        <div className='grid grid-cols-2 gap-x-4 gap-y-3 justify-items-center'>
          <CombinedWheelCell
            side='left'
            wear={perWheelWear.frontLeft}
            innerTemp={tires.front_left_inner}
            outerTemp={tires.front_left_outer}
            inWindow={tiresInWindow[0]}
            blowoutRisk={tireBlowoutRisk[0]}
            blown={tireBlown[0]}
            compoundColor={config.color}
          />
          <CombinedWheelCell
            side='right'
            wear={perWheelWear.frontRight}
            innerTemp={tires.front_right_inner}
            outerTemp={tires.front_right_outer}
            inWindow={tiresInWindow[1]}
            blowoutRisk={tireBlowoutRisk[1]}
            blown={tireBlown[1]}
            compoundColor={config.color}
          />
          <CombinedWheelCell
            side='left'
            wear={perWheelWear.rearLeft}
            innerTemp={tires.rear_left_inner}
            outerTemp={tires.rear_left_outer}
            inWindow={tiresInWindow[2]}
            blowoutRisk={tireBlowoutRisk[2]}
            blown={tireBlown[2]}
            compoundColor={config.color}
          />
          <CombinedWheelCell
            side='right'
            wear={perWheelWear.rearRight}
            innerTemp={tires.rear_right_inner}
            outerTemp={tires.rear_right_outer}
            inWindow={tiresInWindow[3]}
            blowoutRisk={tireBlowoutRisk[3]}
            blown={tireBlown[3]}
            compoundColor={config.color}
          />
        </div>
      </div>

      <div className='border-t border-white/10 px-3 py-2'>
        <div className='mb-1 flex items-baseline justify-between'>
          <LabelTag>Avg Life</LabelTag>
          <span
            className={`${HUD_NUMERIC_CLASS} text-[11px]`}
            style={{ color: wearColor(averageWear) }}
          >
            {Math.round(avgRemaining)}%
          </span>
        </div>
        <div className='h-1 overflow-hidden bg-white/10'>
          <div
            className='h-full transition-[width,background-color] duration-300'
            style={{ width: `${avgRemaining}%`, background: wearColor(averageWear) }}
          />
        </div>

        {(hasGrainingWarn || hasBlisteringWarn) && (
          <div className='mt-2 flex flex-col gap-1'>
            {hasGrainingWarn && (
              <div
                className='flex items-center justify-between px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.28em]'
                style={{
                  background: 'rgba(245,158,11,0.14)',
                  border: `1px solid ${HUD_STATUS.warning}59`,
                  color: HUD_STATUS.warning,
                }}
              >
                <span>Graining</span>
                <span className='font-mono tabular-nums'>{Math.round(maxGraining * 100)}%</span>
              </div>
            )}
            {hasBlisteringWarn && (
              <div
                className='flex items-center justify-between px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.28em]'
                style={{
                  background: 'rgba(239,68,68,0.14)',
                  border: `1px solid ${HUD_STATUS.danger}59`,
                  color: HUD_STATUS.danger,
                }}
              >
                <span>Blistering</span>
                <span className='font-mono tabular-nums'>{Math.round(maxBlistering * 100)}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className='border-t border-white/10 px-3 py-2'>
        <div className='mb-1 flex items-baseline justify-between'>
          <LabelTag>Engine</LabelTag>
          {engineSeized ? (
            <span
              className={`${HUD_NUMERIC_CLASS} text-[9px] font-bold`}
              style={{ color: HUD_STATUS.danger }}
            >
              FAILURE
            </span>
          ) : powerLoss > 0 ? (
            <span
              className={`${HUD_NUMERIC_CLASS} text-[9px] font-bold`}
              style={{ color: HUD_STATUS.danger }}
            >
              −{powerLoss}% PWR
            </span>
          ) : (
            <span className={`${HUD_NUMERIC_CLASS} text-[9px] font-bold text-white/35`}>
              {engineSeized ? 'SEIZED' : `${engineTempC}°C`}
            </span>
          )}
        </div>
        <div className='h-1 overflow-hidden bg-white/10'>
          <div
            className='h-full transition-[width,background-color] duration-200'
            style={{
              width: `${Math.min(100, (engine.temperature / 1.4) * 100)}%`,
              background: engineColor,
            }}
          />
        </div>
        {engineDanger && !engineSeized ? (
          <div
            className='mt-1 h-0.5 overflow-hidden'
            style={{ background: `${HUD_STATUS.danger}26` }}
          >
            <div
              className='h-full transition-[width] duration-200'
              style={{
                width: `${Math.min(100, engineSeizeRisk * 100)}%`,
                background: HUD_STATUS.danger,
              }}
            />
          </div>
        ) : null}
      </div>

      <div className='flex items-center justify-between border-t border-white/10 px-3 py-2'>
        <Cell label='Brake'>
          <div className={`${HUD_NUMERIC_CLASS} flex items-baseline gap-1 text-[12px]`}>
            <span style={{ color: biasTone }}>{Math.round(frontBias)}</span>
            <span className='text-white/35'>:</span>
            <span style={{ color: biasTone }}>{Math.round(rearBias)}</span>
          </div>
        </Cell>
        <Cell label='EB' align='end'>
          <span className={`${HUD_NUMERIC_CLASS} text-[12px]`} style={{ color: eb.color }}>
            EB·{eb.abbrev}
          </span>
        </Cell>
      </div>
    </Surface>
  )
}
