import type { TerrainBrushType } from '@/utils/terrainBrush'

export const BRUSH_TYPES: Array<{ id: TerrainBrushType; label: string }> = [
  { id: 'raise', label: 'Raise' },
  { id: 'lower', label: 'Lower' },
  { id: 'flatten', label: 'Flatten' },
  { id: 'smooth', label: 'Smooth' },
]
