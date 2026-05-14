import { create } from 'zustand'
import type { TerrainBrushType } from '../utils/terrainBrush'

interface TerrainBrushState {
  terrainBrushType: TerrainBrushType
  terrainBrushRadius: number
  terrainBrushStrength: number
  terrainFlattenTarget: number

  setBrushType: (type: TerrainBrushType) => void
  setBrushRadius: (radius: number) => void
  setBrushStrength: (strength: number) => void
  setFlattenTarget: (target: number) => void
}

export const useTerrainBrushStore = create<TerrainBrushState>(set => ({
  terrainBrushType: 'raise',
  terrainBrushRadius: 15,
  terrainBrushStrength: 1.0,
  terrainFlattenTarget: 0,

  setBrushType: type => set({ terrainBrushType: type }),
  setBrushRadius: radius => set({ terrainBrushRadius: radius }),
  setBrushStrength: strength => set({ terrainBrushStrength: strength }),
  setFlattenTarget: target => set({ terrainFlattenTarget: target }),
}))
