import type { LayerGroup } from '../types/trackObjects'
import { useLayerToggleStore } from './useLayerToggleStore'

const LAYER_LABELS: Record<LayerGroup, string> = {
  surface: 'Asphalt surface',
  edge: 'Edge lines',
  painted: 'Painted area',
  curb: 'Curbs',
  pit: 'Pit lane',
}

const LAYER_ORDER: LayerGroup[] = ['surface', 'edge', 'painted', 'curb', 'pit']

interface LayerTogglePanelProps {
  trackName: string
}

export default function LayerTogglePanel({ trackName }: LayerTogglePanelProps) {
  const visible = useLayerToggleStore(s => s.visible)
  const toggle = useLayerToggleStore(s => s.toggle)

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        padding: 16,
        background: 'rgba(20, 20, 32, 0.85)',
        border: '1px solid #333',
        borderRadius: 8,
        color: '#eee',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 13,
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Track: {trackName}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {LAYER_ORDER.map(group => (
          <label key={group} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type='checkbox'
              checked={visible[group]}
              onChange={() => toggle(group)}
              style={{ accentColor: '#9cf' }}
            />
            {LAYER_LABELS[group]}
          </label>
        ))}
      </div>
    </div>
  )
}
