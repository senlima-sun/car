import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const CAR_PARTS = [
  { id: 'body', label: 'Body', meshNames: ['Car_Livery_1'] },
  { id: 'secondary', label: 'Floor', meshNames: ['Car_Livery_1.001'] },
  { id: 'nose', label: 'Nose', meshNames: ['Car_Livery_NOSE', 'Car_Livery_PRE_NOSE'] },
  { id: 'halo', label: 'Halo', meshNames: ['Car_Livery_HALO'] },
  {
    id: 'frontWing',
    label: 'Front Wing',
    meshNames: ['Car_Livery_FW', 'Car_Livery_FW-M', 'Car_Livery_FW-T'],
  },
  { id: 'rearWing', label: 'Rear Wing', meshNames: ['Car_Livery_BW-M', 'Car_Livery_BW-L'] },
  { id: 'mirrors', label: 'Mirrors', meshNames: ['Car_Livery_LREARVIEW', 'Car_Livery_RREARVIEW'] },
  {
    id: 'brackets',
    label: 'Brackets',
    meshNames: [
      'Car_Livery_BL-Bracket',
      'Car_Livery_Car_Livery_BR-Bracket',
      'Car_Livery_FL-Bracket',
      'Car_Livery_FR-Bracket',
    ],
  },
  {
    id: 'wheelCovers',
    label: 'Wheels',
    meshNames: ['WheelCover_FL', 'WheelCover_FR', 'WheelCover_RL', 'WheelCover_RR'],
  },
] as const

export type CarPartId = (typeof CAR_PARTS)[number]['id']

export function getPartIdForMesh(meshName: string): CarPartId | null {
  for (const part of CAR_PARTS) {
    if ((part.meshNames as readonly string[]).includes(meshName)) return part.id
  }
  return null
}

export interface CarPaintPreset {
  name: string
  colors: Partial<Record<CarPartId, string>>
  flakeIntensity: number
  flakeScale: number
  clearcoatStrength: number
  colorDepthFactor: number
}

const DEFAULT_COLOR = '#0a1128'
const CARBON = '#1a1a1a'
const TITANIUM = '#8a8a8a'

export const PAINT_PRESETS: CarPaintPreset[] = [
  {
    name: 'Midnight Blue',
    colors: {
      body: '#0a1128',
      secondary: '#0a1128',
      nose: '#0a1128',
      halo: TITANIUM,
      frontWing: '#0a1128',
      rearWing: '#0a1128',
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    },
    flakeIntensity: 0.4,
    flakeScale: 800,
    clearcoatStrength: 0.8,
    colorDepthFactor: 0.3,
  },
  {
    name: 'Racing Red',
    colors: {
      body: '#8b1a1a',
      secondary: CARBON,
      nose: '#8b1a1a',
      halo: TITANIUM,
      frontWing: '#8b1a1a',
      rearWing: '#8b1a1a',
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    },
    flakeIntensity: 0.5,
    flakeScale: 900,
    clearcoatStrength: 0.85,
    colorDepthFactor: 0.35,
  },
  {
    name: 'British Green',
    colors: {
      body: '#0d3b1e',
      secondary: '#0d3b1e',
      nose: '#0d3b1e',
      halo: TITANIUM,
      frontWing: '#0d3b1e',
      rearWing: '#0d3b1e',
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    },
    flakeIntensity: 0.35,
    flakeScale: 750,
    clearcoatStrength: 0.75,
    colorDepthFactor: 0.25,
  },
  {
    name: 'Papaya Orange',
    colors: {
      body: '#c45e1a',
      secondary: CARBON,
      nose: '#c45e1a',
      halo: TITANIUM,
      frontWing: '#c45e1a',
      rearWing: CARBON,
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    },
    flakeIntensity: 0.45,
    flakeScale: 850,
    clearcoatStrength: 0.8,
    colorDepthFactor: 0.3,
  },
  {
    name: 'Silver Arrow',
    colors: {
      body: '#9a9a9a',
      secondary: '#5a5a5a',
      nose: '#9a9a9a',
      halo: '#c0c0c0',
      frontWing: '#9a9a9a',
      rearWing: '#9a9a9a',
      mirrors: '#5a5a5a',
      brackets: '#5a5a5a',
      wheelCovers: '#5a5a5a',
    },
    flakeIntensity: 0.6,
    flakeScale: 1000,
    clearcoatStrength: 0.9,
    colorDepthFactor: 0.15,
  },
  {
    name: 'Gulf Livery',
    colors: {
      body: '#6bb7d8',
      secondary: CARBON,
      nose: '#6bb7d8',
      halo: TITANIUM,
      frontWing: '#c45e1a',
      rearWing: '#c45e1a',
      mirrors: '#c45e1a',
      brackets: CARBON,
      wheelCovers: CARBON,
    },
    flakeIntensity: 0.3,
    flakeScale: 700,
    clearcoatStrength: 0.7,
    colorDepthFactor: 0.2,
  },
  {
    name: 'Matte Black',
    colors: {
      body: CARBON,
      secondary: CARBON,
      nose: CARBON,
      halo: CARBON,
      frontWing: CARBON,
      rearWing: CARBON,
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    },
    flakeIntensity: 0.1,
    flakeScale: 600,
    clearcoatStrength: 0.3,
    colorDepthFactor: 0.4,
  },
  {
    name: 'Pearl White',
    colors: {
      body: '#e8e4df',
      secondary: '#e8e4df',
      nose: '#e8e4df',
      halo: '#c0c0c0',
      frontWing: '#e8e4df',
      rearWing: '#e8e4df',
      mirrors: '#e8e4df',
      brackets: '#c0c0c0',
      wheelCovers: '#c0c0c0',
    },
    flakeIntensity: 0.55,
    flakeScale: 950,
    clearcoatStrength: 0.85,
    colorDepthFactor: 0.1,
  },
  {
    name: 'Candy Purple',
    colors: {
      body: '#4a1a6b',
      secondary: CARBON,
      nose: '#4a1a6b',
      halo: TITANIUM,
      frontWing: '#4a1a6b',
      rearWing: '#4a1a6b',
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    },
    flakeIntensity: 0.5,
    flakeScale: 850,
    clearcoatStrength: 0.8,
    colorDepthFactor: 0.35,
  },
  {
    name: 'Champagne Gold',
    colors: {
      body: '#b8965a',
      secondary: '#2a2018',
      nose: '#b8965a',
      halo: '#b8965a',
      frontWing: '#b8965a',
      rearWing: '#2a2018',
      mirrors: '#2a2018',
      brackets: '#2a2018',
      wheelCovers: '#2a2018',
    },
    flakeIntensity: 0.65,
    flakeScale: 1100,
    clearcoatStrength: 0.85,
    colorDepthFactor: 0.2,
  },
]

interface CarPaintState {
  partColors: Record<CarPartId, string>
  selectedPart: CarPartId | 'all'
  flakeIntensity: number
  flakeScale: number
  clearcoatStrength: number
  colorDepthFactor: number

  setPartColor: (partId: CarPartId, color: string) => void
  setAllColors: (color: string) => void
  setSelectedPart: (partId: CarPartId | 'all') => void
  setFlakeIntensity: (v: number) => void
  setFlakeScale: (v: number) => void
  setClearcoatStrength: (v: number) => void
  setColorDepthFactor: (v: number) => void
  applyPreset: (preset: CarPaintPreset) => void
  getColorForPart: (partId: CarPartId) => string
  setActiveColor: (color: string) => void
}

const defaultPartColors: Record<CarPartId, string> = {
  body: DEFAULT_COLOR,
  secondary: DEFAULT_COLOR,
  nose: DEFAULT_COLOR,
  halo: TITANIUM,
  frontWing: DEFAULT_COLOR,
  rearWing: DEFAULT_COLOR,
  mirrors: CARBON,
  brackets: CARBON,
  wheelCovers: CARBON,
}

const ALL_PART_IDS = CAR_PARTS.map(p => p.id)

export const useCarPaintStore = create<CarPaintState>()(
  persist(
    (set, get) => ({
      partColors: { ...defaultPartColors },
      selectedPart: 'all' as CarPartId | 'all',
      flakeIntensity: 0.4,
      flakeScale: 800,
      clearcoatStrength: 0.8,
      colorDepthFactor: 0.3,

      setPartColor: (partId, color) =>
        set(state => ({
          partColors: { ...state.partColors, [partId]: color },
        })),

      setAllColors: color =>
        set(() => {
          const colors = {} as Record<CarPartId, string>
          for (const id of ALL_PART_IDS) colors[id] = color
          return { partColors: colors }
        }),

      setSelectedPart: selectedPart => set({ selectedPart }),

      setFlakeIntensity: flakeIntensity => set({ flakeIntensity }),
      setFlakeScale: flakeScale => set({ flakeScale }),
      setClearcoatStrength: clearcoatStrength => set({ clearcoatStrength }),
      setColorDepthFactor: colorDepthFactor => set({ colorDepthFactor }),

      applyPreset: preset =>
        set(() => {
          const colors = { ...defaultPartColors }
          for (const [k, v] of Object.entries(preset.colors)) {
            colors[k as CarPartId] = v
          }
          return {
            partColors: colors,
            flakeIntensity: preset.flakeIntensity,
            flakeScale: preset.flakeScale,
            clearcoatStrength: preset.clearcoatStrength,
            colorDepthFactor: preset.colorDepthFactor,
          }
        }),

      getColorForPart: (partId: CarPartId) => get().partColors[partId] ?? DEFAULT_COLOR,

      setActiveColor: color => {
        const { selectedPart } = get()
        if (selectedPart === 'all') {
          get().setAllColors(color)
        } else {
          get().setPartColor(selectedPart, color)
        }
      },
    }),
    {
      name: 'car-paint-settings',
      partialize: state => ({
        partColors: state.partColors,
        flakeIntensity: state.flakeIntensity,
        flakeScale: state.flakeScale,
        clearcoatStrength: state.clearcoatStrength,
        colorDepthFactor: state.colorDepthFactor,
      }),
    },
  ),
)
