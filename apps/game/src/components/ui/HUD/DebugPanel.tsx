import { selectAverageWear, useTireStore } from '../../../stores/useTireStore'
import { useErsStore } from '../../../stores/useErsStore'
import { TIRE_CONFIG, TIRE_ORDER, type TireCompound } from '../../../constants/tires'
import {
  TireCompound as TireCompoundWasm,
  setTireCompound as setTireCompoundWasm,
  setErsBatteryCharge,
} from '../../../wasm/PhysicsBridge'
import { AccentBar, Surface } from '../primitives'

const compoundToWasm: Record<TireCompound, TireCompoundWasm> = {
  soft: TireCompoundWasm.Soft,
  medium: TireCompoundWasm.Medium,
  hard: TireCompoundWasm.Hard,
  wet: TireCompoundWasm.Wet,
  intermediate: TireCompoundWasm.Intermediate,
}

const TITLE = 'text-[#ffa500] text-[10px] font-bold uppercase tracking-[1px]'
const BADGE = 'bg-[#ffa500]/20 text-[#ffa500] text-[8px] px-1.5 py-0.5 rounded font-bold'
const ROW = 'flex items-center gap-2'
const LABEL = 'text-white/60 text-[10px] min-w-[70px]'
const SLIDER =
  'flex-1 h-1 appearance-none rounded-[2px] outline-none cursor-pointer'
const VALUE = 'text-white font-bold text-[11px] min-w-[35px] text-right font-mono'
const BUTTON_ROW = 'flex gap-1.5 mt-1'
const BUTTON_BASE =
  'flex-1 border-0 rounded px-2 py-1.5 text-white text-[10px] cursor-pointer transition-colors duration-150'
const COMPOUND_ROW = 'flex gap-1 mt-1'
const COMPOUND_BUTTON_BASE =
  'flex-1 px-1 py-1.5 rounded border-2 border-transparent cursor-pointer flex flex-col items-center gap-0.5 transition-all duration-150'
const COMPOUND_ICON = 'text-xs font-bold'
const COMPOUND_NAME = 'text-[7px] uppercase opacity-80'

function getWearColor(wear: number): string {
  if (wear >= 90) return '#ef4444'
  if (wear >= 70) return '#f59e0b'
  return '#22c55e'
}

const ERS_PRESETS = ['Balanced', 'Aggressive', 'Conservative'] as const
type ErsPreset = (typeof ERS_PRESETS)[number]

function getErsPresetColor(preset: ErsPreset): string {
  switch (preset) {
    case 'Aggressive':
      return '#ef4444'
    case 'Conservative':
      return '#3b82f6'
    case 'Balanced':
      return '#f59e0b'
    default:
      return '#ffffff'
  }
}

function getBatteryColor(charge: number): string {
  if (charge > 50) return '#22c55e'
  if (charge > 20) return '#f59e0b'
  return '#ef4444'
}

export default function DebugPanel() {
  const averageWear = useTireStore(selectAverageWear)
  const debugMode = useTireStore(state => state.debugMode)
  const setWearDebug = useTireStore(state => state.setWearDebug)
  const disableDebugMode = useTireStore(state => state.disableDebugMode)
  const currentCompound = useTireStore(state => state.currentCompound)
  const setTireCompound = useTireStore(state => state.setTireCompound)

  const batteryCharge = useErsStore(state => state.batteryCharge)
  const semiAutoConfig = useErsStore(state => state.semiAutoConfig)
  const setSemiAutoPreset = useErsStore(state => state.setSemiAutoPreset)
  const powerFlow = useErsStore(state => state.powerFlow)
  const superClipActive = useErsStore(state => state.superClipActive)
  const harvestSource = useErsStore(state => state.harvestSource)

  const tireLife = Math.max(0, 100 - averageWear)

  const handleCompoundChange = (compound: TireCompound) => {
    setTireCompound(compound)
    try {
      setTireCompoundWasm(compoundToWasm[compound])
    } catch {
      // WASM may not be initialized yet
    }
  }

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const wear = Number(e.target.value)
    setWearDebug(wear)
  }

  const handleReset = () => {
    setWearDebug(0)
  }

  const handlePreset = (wear: number) => {
    setWearDebug(wear)
  }

  const handleSyncToggle = () => {
    if (debugMode) {
      disableDebugMode()
    }
  }

  const handleBatteryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const charge = Number(e.target.value) / 100
    try {
      setErsBatteryCharge(charge)
    } catch {
      // WASM may not be initialized yet
    }
  }

  const handlePresetChange = (preset: ErsPreset) => {
    setSemiAutoPreset(preset)
  }

  const handleBatteryPreset = (charge: number) => {
    try {
      setErsBatteryCharge(charge / 100)
    } catch {
      // WASM may not be initialized yet
    }
  }

  const wearColor = getWearColor(averageWear)
  const batteryColor = getBatteryColor(batteryCharge)
  const powerColor =
    powerFlow > 0 ? '#22c55e' : powerFlow < 0 ? '#3b82f6' : 'rgba(255,255,255,0.5)'
  const harvestColor =
    harvestSource === 'SuperClip'
      ? '#a855f7'
      : harvestSource === 'Braking'
        ? '#ef4444'
        : '#3b82f6'

  return (
    <Surface
      variant='cardStrong'
      className='relative px-3.5 py-2.5 flex flex-col gap-2 text-[11px] min-w-[180px]'
    >
      <AccentBar color='#ffa500' />
      <div className='flex justify-between items-center'>
        <span className={TITLE}>Debug Tools</span>
        {debugMode && <span className={BADGE}>PAUSED</span>}
      </div>

      <div className={ROW}>
        <span className={LABEL}>Compound</span>
      </div>
      <div className={COMPOUND_ROW}>
        {TIRE_ORDER.map(compound => {
          const config = TIRE_CONFIG[compound]
          const isActive = currentCompound === compound
          return (
            <button
              key={compound}
              onClick={() => handleCompoundChange(compound)}
              className={COMPOUND_BUTTON_BASE}
              style={{
                background: isActive ? config.color : 'rgba(255, 255, 255, 0.1)',
                borderColor: isActive ? config.color : 'transparent',
                color: isActive
                  ? compound === 'hard'
                    ? '#000'
                    : '#fff'
                  : 'rgba(255, 255, 255, 0.7)',
              }}
            >
              <span className={COMPOUND_ICON}>{config.icon}</span>
              <span className={COMPOUND_NAME}>{config.displayName.slice(0, 3)}</span>
            </button>
          )
        })}
      </div>

      <div className={ROW}>
        <span className={LABEL}>Tire Wear</span>
        <input
          type='range'
          min='0'
          max='100'
          step='1'
          value={averageWear}
          onChange={handleSliderChange}
          className={SLIDER}
          style={{
            background: `linear-gradient(to right, ${wearColor} ${averageWear}%, rgba(255,255,255,0.15) ${averageWear}%)`,
          }}
        />
        <span className={VALUE} style={{ color: wearColor }}>
          {Math.round(averageWear)}%
        </span>
      </div>

      <div className={ROW}>
        <span className={LABEL}>Tire Life</span>
        <span
          className='text-white font-bold text-[11px] min-w-[35px] text-left font-mono flex-1'
          style={{ color: wearColor }}
        >
          {Math.round(tireLife)}%
        </span>
      </div>

      <div className={BUTTON_ROW}>
        <button
          className={`${BUTTON_BASE} bg-white/10 hover:bg-[#22c55e]/30`}
          onClick={handleReset}
        >
          New (0%)
        </button>
        <button
          className={`${BUTTON_BASE} bg-white/10 hover:bg-[#f59e0b]/30`}
          onClick={() => handlePreset(50)}
        >
          Half (50%)
        </button>
        <button
          className={`${BUTTON_BASE} bg-white/10 hover:bg-[#ef4444]/30`}
          onClick={() => handlePreset(85)}
        >
          Worn (85%)
        </button>
      </div>

      <div className='flex items-center gap-1.5 mt-1 pt-1.5 border-t border-white/10'>
        <input
          type='checkbox'
          id='debug-sync'
          checked={!debugMode}
          onChange={handleSyncToggle}
          className='w-3.5 h-3.5 cursor-pointer accent-[#22c55e]'
        />
        <label htmlFor='debug-sync' className='text-white/50 text-[9px]'>
          {debugMode ? 'Enable wear sync (resume normal)' : 'Wear syncing from physics'}
        </label>
      </div>

      <div className='h-px bg-[#ffa500]/30 my-2' />

      <div className='flex justify-between items-center'>
        <span className={TITLE}>ERS Tuning</span>
        {superClipActive && (
          <span className='bg-[#a855f7]/30 text-[#a855f7] text-[8px] px-1.5 py-0.5 rounded font-bold'>
            CLIP
          </span>
        )}
      </div>

      <div className={ROW}>
        <span className={LABEL}>Preset</span>
      </div>
      <div className={COMPOUND_ROW}>
        {ERS_PRESETS.map(preset => {
          const isActive = semiAutoConfig.preset === preset
          const color = getErsPresetColor(preset)
          return (
            <button
              key={preset}
              onClick={() => handlePresetChange(preset)}
              className={COMPOUND_BUTTON_BASE}
              style={{
                background: isActive ? color : 'rgba(255, 255, 255, 0.1)',
                borderColor: isActive ? color : 'transparent',
                color: isActive ? '#fff' : 'rgba(255, 255, 255, 0.7)',
              }}
            >
              <span className={COMPOUND_ICON}>
                {preset === 'Aggressive' ? '↑' : preset === 'Conservative' ? '↓' : '⟷'}
              </span>
              <span className={COMPOUND_NAME}>{preset.slice(0, 3).toUpperCase()}</span>
            </button>
          )
        })}
      </div>

      <div className={ROW}>
        <span className={LABEL}>Battery</span>
        <input
          type='range'
          min='0'
          max='100'
          step='1'
          value={batteryCharge}
          onChange={handleBatteryChange}
          className={SLIDER}
          style={{
            background: `linear-gradient(to right, ${batteryColor} ${batteryCharge}%, rgba(255,255,255,0.15) ${batteryCharge}%)`,
          }}
        />
        <span className={VALUE} style={{ color: batteryColor }}>
          {Math.round(batteryCharge)}%
        </span>
      </div>

      <div className={ROW}>
        <span className={LABEL}>Power</span>
        <span
          className='text-white font-bold text-[11px] min-w-[35px] text-left font-mono flex-1'
          style={{ color: powerColor }}
        >
          {powerFlow > 0 ? '↑' : powerFlow < 0 ? '↓' : ''} {Math.abs(Math.round(powerFlow))} kW
        </span>
        {harvestSource !== 'None' && (
          <span className='text-[9px]' style={{ color: harvestColor }}>
            {harvestSource === 'SuperClip' ? 'CLIP' : harvestSource === 'Braking' ? 'BRK' : 'CST'}
          </span>
        )}
      </div>

      <div className={BUTTON_ROW}>
        <button
          className={`${BUTTON_BASE} bg-white/10 hover:bg-[#22c55e]/30`}
          onClick={() => handleBatteryPreset(100)}
        >
          Full
        </button>
        <button
          className={`${BUTTON_BASE} bg-white/10 hover:bg-[#f59e0b]/30`}
          onClick={() => handleBatteryPreset(50)}
        >
          50%
        </button>
        <button
          className={`${BUTTON_BASE} bg-white/10 hover:bg-[#ef4444]/30`}
          onClick={() => handleBatteryPreset(0)}
        >
          Empty
        </button>
      </div>
    </Surface>
  )
}
