import { useTerrainBrushStore } from '@/stores/useTerrainBrushStore'
import { useTerrainStore } from '@/stores/useTerrainStore'
import { useTrackStore } from '@/stores/useTrackStore'
import { applyStampedSidecar } from '@/utils/terrainStampedSidecar'
import { BRUSH_TYPES } from './constants/brushTypes'
import { SliderRow } from './primitives/SliderRow'

async function importSidecarForActiveTrack(): Promise<void> {
  const active = useTrackStore.getState().getActiveTrack()
  if (!active?.presetId) {
    alert('Import elevation requires an active preset track (e.g. F1 circuits).')
    return
  }
  // "Import Real Elevation" is the destructive action — user
  // explicitly asked for a fresh DEM, so reset delta along with it.
  const { applied } = await applyStampedSidecar(active.presetId, active.objects, {
    deltaPolicy: 'reset',
  })
  if (!applied) {
    alert(
      `No elevation sidecar for "${active.presetId}". Run "bun run track:elevation:fetch <name>" to generate one.`,
    )
    return
  }
  useTrackStore.getState().markDirty()
}

export function TerrainControls() {
  const brushType = useTerrainBrushStore(s => s.terrainBrushType)
  const radius = useTerrainBrushStore(s => s.terrainBrushRadius)
  const strength = useTerrainBrushStore(s => s.terrainBrushStrength)
  const flattenTarget = useTerrainBrushStore(s => s.terrainFlattenTarget)
  const setBrushType = useTerrainBrushStore(s => s.setBrushType)
  const setRadius = useTerrainBrushStore(s => s.setBrushRadius)
  const setStrength = useTerrainBrushStore(s => s.setBrushStrength)
  const setFlattenTarget = useTerrainBrushStore(s => s.setFlattenTarget)
  const resetHeightmap = useTerrainStore(s => s.resetHeightmap)
  const commitPhysics = useTerrainStore(s => s.commitPhysics)

  return (
    <div className='pointer-events-auto absolute left-4 top-16 z-20 w-64 rounded-2xl border border-white/10 bg-[rgba(14,16,22,0.88)] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.32)] backdrop-blur-xl'>
      <div className='mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/48'>
        Terrain Brush
      </div>
      <div className='mb-3 grid grid-cols-4 gap-1'>
        {BRUSH_TYPES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setBrushType(id)}
            className={`rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
              brushType === id
                ? 'bg-white/[0.14] text-white'
                : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <SliderRow
        label='Radius'
        value={radius}
        min={10}
        max={400}
        step={1}
        unit='m'
        onChange={setRadius}
      />
      <SliderRow
        label='Strength'
        value={strength}
        min={0.1}
        max={10}
        step={0.1}
        unit='m/s'
        onChange={setStrength}
      />
      {brushType === 'flatten' && (
        <SliderRow
          label='Target'
          value={flattenTarget}
          min={-20}
          max={20}
          step={0.5}
          unit='m'
          onChange={setFlattenTarget}
        />
      )}
      <button
        onClick={() => {
          if (confirm('Import real-world elevation for this circuit?')) {
            void importSidecarForActiveTrack()
          }
        }}
        className='mt-2 w-full rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-[10px] font-medium text-white/52 transition hover:border-sky-500/50 hover:text-sky-300'
      >
        Import Real Elevation
      </button>
      <button
        onClick={() => {
          if (confirm('Reset terrain to flat?')) {
            resetHeightmap()
            commitPhysics()
            useTrackStore.getState().markDirty()
          }
        }}
        className='mt-2 w-full rounded-md border border-white/10 bg-transparent px-2 py-1.5 text-[10px] font-medium text-white/52 transition hover:border-rose-500/50 hover:text-rose-300'
      >
        Reset Terrain
      </button>
    </div>
  )
}
