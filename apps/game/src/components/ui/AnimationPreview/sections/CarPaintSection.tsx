import { useState } from 'react'
import {
  CAR_PARTS,
  DEFAULT_PART_MATERIAL_SETTINGS,
  PAINT_PRESETS,
  useCarPaintStore,
} from '@/stores/useCarPaintStore'
import { Chip } from '../primitives/Chip'
import { Section } from '../primitives/Section'
import { Slider } from '../primitives/Slider'

export function CarPaintSection() {
  const partColors = useCarPaintStore(s => s.partColors)
  const partMaterialSettings = useCarPaintStore(s => s.partMaterialSettings)
  const selectedPart = useCarPaintStore(s => s.selectedPart)
  const isolateSelected = useCarPaintStore(s => s.isolateSelected)
  const flakeIntensity = useCarPaintStore(s => s.flakeIntensity)
  const clearcoatStrength = useCarPaintStore(s => s.clearcoatStrength)
  const colorDepthFactor = useCarPaintStore(s => s.colorDepthFactor)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const store = useCarPaintStore.getState
  const activeColor = selectedPart === 'all' ? partColors.body : partColors[selectedPart]
  const activeMaterialSettings =
    selectedPart === 'all' ? partMaterialSettings.body : partMaterialSettings[selectedPart]
  const canIsolate = selectedPart !== 'all'
  const activePresetName = PAINT_PRESETS.find(
    p => p.colors.body && p.colors.body.toLowerCase() === partColors.body.toLowerCase(),
  )?.name

  return (
    <Section title='Paint'>
      <div className='flex flex-wrap gap-1'>
        <Chip
          label='All'
          active={selectedPart === 'all'}
          onClick={() => store().setSelectedPart('all')}
        />
        {CAR_PARTS.map(part => (
          <button
            key={part.id}
            onClick={() => store().setSelectedPart(part.id)}
            className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[9px] uppercase tracking-[0.2em] transition ${
              selectedPart === part.id
                ? 'border-red-300/60 bg-red-400/15 text-red-100'
                : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white/90'
            }`}
          >
            <span
              className='inline-block h-2 w-2 rounded-full border border-white/20'
              style={{ backgroundColor: partColors[part.id] }}
            />
            {part.label}
          </button>
        ))}
      </div>

      <div className='grid grid-cols-5 gap-1.5 pt-2'>
        {PAINT_PRESETS.map(preset => {
          const swatch =
            selectedPart === 'all'
              ? preset.colors.body
              : (preset.colors[selectedPart] ?? preset.colors.body ?? '#0a1128')
          const isActive = preset.name === activePresetName && selectedPart === 'all'
          return (
            <button
              key={preset.name}
              title={preset.name}
              onClick={() => {
                if (selectedPart === 'all') {
                  store().applyPreset(preset)
                } else {
                  store().setPartColor(
                    selectedPart,
                    preset.colors[selectedPart] ?? preset.colors.body ?? '#0a1128',
                  )
                  const materialSettings =
                    preset.materialSettings?.[selectedPart] ?? DEFAULT_PART_MATERIAL_SETTINGS
                  store().setPartRoughness(
                    selectedPart,
                    materialSettings.roughness ?? DEFAULT_PART_MATERIAL_SETTINGS.roughness,
                  )
                  store().setPartMetalness(
                    selectedPart,
                    materialSettings.metalness ?? DEFAULT_PART_MATERIAL_SETTINGS.metalness,
                  )
                }
              }}
              className={`aspect-square w-full cursor-pointer rounded-md border transition hover:scale-105 ${
                isActive
                  ? 'border-red-300/70 ring-2 ring-red-300/40 ring-offset-1 ring-offset-black/60'
                  : 'border-white/10 hover:border-white/30'
              }`}
              style={{ backgroundColor: swatch }}
            />
          )
        })}
      </div>

      <div className='flex items-center gap-2 pt-2'>
        <input
          type='color'
          value={activeColor}
          onChange={e => store().setActiveColor(e.target.value)}
          className='showroom-color h-6 w-8'
        />
        <span className='font-mono text-[10px] tabular-nums text-white/55'>
          {activeColor.toUpperCase()}
        </span>
        <Chip
          label='Isolate'
          active={isolateSelected && canIsolate}
          disabled={!canIsolate}
          onClick={() => store().setIsolateSelected(!isolateSelected)}
        />
        <Chip
          label={showAdvanced ? 'Hide' : 'Shader'}
          active={showAdvanced}
          onClick={() => setShowAdvanced(s => !s)}
        />
      </div>

      {showAdvanced && (
        <div className='pt-2'>
          <Slider
            label='Roughness'
            value={activeMaterialSettings.roughness}
            min={0}
            max={1}
            step={0.01}
            onChange={v => store().setActiveRoughness(v)}
          />
          <Slider
            label='Metalness'
            value={activeMaterialSettings.metalness}
            min={0}
            max={1}
            step={0.01}
            onChange={v => store().setActiveMetalness(v)}
          />
          <Slider
            label='Flake'
            value={flakeIntensity}
            min={0}
            max={1}
            step={0.01}
            onChange={v => store().setFlakeIntensity(v)}
          />
          <Slider
            label='Clearcoat'
            value={clearcoatStrength}
            min={0}
            max={1}
            step={0.01}
            onChange={v => store().setClearcoatStrength(v)}
          />
          <Slider
            label='Depth'
            value={colorDepthFactor}
            min={0}
            max={0.6}
            step={0.01}
            onChange={v => store().setColorDepthFactor(v)}
          />
        </div>
      )}
    </Section>
  )
}
