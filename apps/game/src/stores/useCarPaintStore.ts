import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const CAR_PARTS = [
  {
    id: 'body',
    label: 'Body',
    meshNames: ['Car_Livery_1', 'Body_Generic_Shell'],
  },
  {
    id: 'engineCover',
    label: 'Engine Cover',
    meshNames: [
      'Car_Livery_EngineCover_L',
      'Car_Livery_EngineCover_R',
      'Car_Livery_EngineCover_Top',
    ],
  },
  {
    id: 'airHorn',
    label: 'Air Horn',
    meshNames: ['Body_Airbox_Horn'],
  },
  {
    id: 'sidepods',
    label: 'Sidepods',
    meshNames: [
      'Car_Livery_FrontSidepod_L',
      'Car_Livery_FrontSidepod_R',
      'Car_Livery_Sidepod_L',
      'Car_Livery_Sidepod_R',
    ],
  },
  {
    id: 'secondary',
    label: 'Floor',
    meshNames: [
      'Car_Livery_1.001',
      'Diffuser_Carbon_Plane',
      'Floor_Base_Panel',
      'Floor_Base_Panel_Secondary',
      'Floor_Carbon_CenterDetail',
      'Floor_Carbon_Lower',
      'Floor_Carbon_Plank',
      'Floor_Carbon_Shell',
      'Floor_Carbon_Upper',
    ],
  },
  {
    id: 'nose',
    label: 'Nose',
    meshNames: [
      'Car_Livery_NOSE',
      'Car_Livery_PRE_NOSE',
      'Nose_Black_Detail',
      'Nose_Livery_Detail',
      'Nose_Livery_Detail_Secondary',
    ],
  },
  {
    id: 'cockpit',
    label: 'Cockpit',
    meshNames: [
      'Car_Livery_CockpitSurround',
      'Cockpit_Black_Insert',
      'Cockpit_Detail_Rail',
      'Cockpit_Fairing_Small',
      'Cockpit_Generic_Insert',
      'Cockpit_Livery_Pin',
    ],
  },
  {
    id: 'cockpitGlass',
    label: 'Cockpit Glass',
    meshNames: ['Cockpit_Glass'],
  },
  {
    id: 'cockpitInterior',
    label: 'Cockpit Interior',
    meshNames: [
      'Cockpit_Chrome_AO_Detail',
      'Cockpit_Chrome_Fasteners',
      'Cockpit_Metal_Detail',
      'Cockpit_Plastic_Interior',
      'Pedals',
      'Seat_Belt',
    ],
  },
  {
    id: 'steeringWheel',
    label: 'Steering Wheel',
    meshNames: [
      'SteeringWheel_Audi',
      'SteeringWheel_Carbon_Back',
      'SteeringWheel_Carbon_LedStrip',
      'SteeringWheel_ClearLed',
      'SteeringWheel_ClearLed_Dot',
      'SteeringWheel_ClearLed_Pre',
      'SteeringWheel_Decal',
      'SteeringWheel_Frame',
      'SteeringWheel_Kers_White',
      'SteeringWheel_LCD',
      'SteeringWheel_Revs_Display',
    ],
  },
  {
    id: 'tcam',
    label: 'T-Cam',
    meshNames: ['TCam'],
  },
  {
    id: 'cameras',
    label: 'Cameras',
    meshNames: ['Camera_360', 'Nose_Camera', 'Shoulder_Camera'],
  },
  {
    id: 'halo',
    label: 'Halo',
    meshNames: ['Car_Livery_HALO', 'Car_Livery_HALO_Base', 'Halo_Front'],
  },
  {
    id: 'frontWing',
    label: 'Front Wing',
    meshNames: [
      'Car_Livery_FW',
      'Car_Livery_FW-M',
      'Car_Livery_FW-T',
      'FrontWing_Adjuster',
      'FrontWing_Endplate_L',
      'FrontWing_Endplate_R',
      'FrontWing_Flap_Lower',
      'FrontWing_MainAssembly',
    ],
  },
  {
    id: 'frontWheelWinglets',
    label: 'Wheel Winglets',
    meshNames: ['FrontWheelWinglet_L', 'FrontWheelWinglet_R'],
  },
  {
    id: 'rearWing',
    label: 'Rear Wing',
    meshNames: ['Car_Livery_BW-M', 'Car_Livery_BW-L', 'RearWing_Chrome_Pin'],
  },
  {
    id: 'rearLight',
    label: 'Rear Light',
    meshNames: ['Rear_Light'],
  },
  {
    id: 'exhaust',
    label: 'Exhaust',
    meshNames: ['Exhaust_Tailpipe'],
  },
  { id: 'mirrors', label: 'Mirrors', meshNames: ['Car_Livery_LREARVIEW', 'Car_Livery_RREARVIEW'] },
  { id: 'mirrorGlass', label: 'Mirror Glass', meshNames: ['Mirror_Glass_L', 'Mirror_Glass_R'] },
  {
    id: 'brackets',
    label: 'Wishbones',
    meshNames: [
      'Car_Livery_BL-Bracket',
      'Car_Livery_Car_Livery_BR-Bracket',
      'Car_Livery_FL-Bracket',
      'Car_Livery_FR-Bracket',
      'FrontSuspension_Carbon_CrossMember',
      'Suspension_Front_LowerArm_L',
      'Suspension_Front_UpperArm_L',
      'Suspension_Front_UpperArm_R',
      'Suspension_Front_Wishbone_L',
      'Suspension_Rear_UpperArm_R',
      'Suspension_Rear_Wishbone_L',
      'Suspension_Rear_Wishbone_R',
    ],
  },
  {
    id: 'brakeHardware',
    label: 'Brake Hardware',
    meshNames: ['BrakeDisc_Front_Pair', 'WheelHubNuts_All'],
  },
  {
    id: 'wheelPanels',
    label: 'Wheel Panels',
    meshNames: ['WheelPanel_FL', 'WheelPanel_FR', 'WheelSidewalls_All'],
  },
  {
    id: 'wheelCovers',
    label: 'Wheels',
    meshNames: [
      'WheelCover_FL',
      'WheelCover_FR',
      'WheelCover_RL',
      'WheelCover_RR',
      'WheelHub_FL',
      'WheelHub_FR',
      'WheelHub_RL',
      'WheelHub_RR',
    ],
  },
] as const

export type CarPartId = (typeof CAR_PARTS)[number]['id']

export interface PartMaterialSettings {
  roughness: number
  metalness: number
}

const PART_BY_MESH_NAME = new Map<string, CarPartId>(
  CAR_PARTS.flatMap(part => part.meshNames.map(meshName => [meshName, part.id] as const)),
)

function getRuntimeMeshNameCandidates(meshName: string): string[] {
  const withoutPrimitiveSuffix = meshName.replace(/_\d+$/, '')
  const withRestoredDot = meshName.replace(/(\d)(\d{3})(?:_\d+)?$/, '$1.$2')
  return [meshName, withoutPrimitiveSuffix, withRestoredDot]
}

export function getPartIdForMesh(meshName: string): CarPartId | null {
  for (const candidate of getRuntimeMeshNameCandidates(meshName)) {
    const partId = PART_BY_MESH_NAME.get(candidate)
    if (partId) return partId
  }
  return null
}

export interface CarPaintPreset {
  name: string
  colors: Partial<Record<CarPartId, string>>
  materialSettings?: Partial<Record<CarPartId, Partial<PartMaterialSettings>>>
  flakeIntensity: number
  flakeScale: number
  clearcoatStrength: number
  colorDepthFactor: number
}

const DEFAULT_COLOR = '#0a1128'
const CARBON = '#1a1a1a'
const TITANIUM = '#8a8a8a'
const GLASS = '#101820'
const REAR_LIGHT = '#c92c2c'
export const DEFAULT_PART_MATERIAL_SETTINGS: PartMaterialSettings = {
  roughness: 0.35,
  metalness: 0.4,
}
const ALL_PART_IDS = CAR_PARTS.map(p => p.id)

function definePresetColors(
  colors: Partial<Record<CarPartId, string>>,
): Partial<Record<CarPartId, string>> {
  return {
    engineCover: colors.engineCover ?? colors.body ?? DEFAULT_COLOR,
    airHorn: colors.airHorn ?? colors.engineCover ?? colors.body ?? DEFAULT_COLOR,
    sidepods: colors.sidepods ?? colors.body ?? DEFAULT_COLOR,
    cockpit: colors.cockpit ?? colors.body ?? DEFAULT_COLOR,
    cockpitGlass: colors.cockpitGlass ?? GLASS,
    cockpitInterior: colors.cockpitInterior ?? CARBON,
    steeringWheel: colors.steeringWheel ?? CARBON,
    tcam: colors.tcam ?? colors.halo ?? TITANIUM,
    cameras: colors.cameras ?? CARBON,
    frontWheelWinglets: colors.frontWheelWinglets ?? colors.frontWing ?? CARBON,
    rearLight: colors.rearLight ?? REAR_LIGHT,
    exhaust: colors.exhaust ?? CARBON,
    mirrorGlass: colors.mirrorGlass ?? GLASS,
    brackets: colors.brackets ?? CARBON,
    brakeHardware: colors.brakeHardware ?? colors.brackets ?? CARBON,
    wheelPanels: colors.wheelPanels ?? colors.wheelCovers ?? CARBON,
    ...colors,
  }
}

function clampMaterialValue(value: number) {
  return Math.min(1, Math.max(0, value))
}

function normalizePartMaterialSettings(
  source?: Partial<Record<CarPartId, Partial<PartMaterialSettings>>>,
): Record<CarPartId, PartMaterialSettings> {
  const settings = {} as Record<CarPartId, PartMaterialSettings>
  for (const id of ALL_PART_IDS) {
    settings[id] = {
      roughness: clampMaterialValue(
        source?.[id]?.roughness ?? DEFAULT_PART_MATERIAL_SETTINGS.roughness,
      ),
      metalness: clampMaterialValue(
        source?.[id]?.metalness ?? DEFAULT_PART_MATERIAL_SETTINGS.metalness,
      ),
    }
  }
  return settings
}

export const PAINT_PRESETS: CarPaintPreset[] = [
  {
    name: 'Midnight Blue',
    colors: definePresetColors({
      body: '#0a1128',
      secondary: '#0a1128',
      nose: '#0a1128',
      halo: TITANIUM,
      frontWing: '#0a1128',
      rearWing: '#0a1128',
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    }),
    flakeIntensity: 0.4,
    flakeScale: 800,
    clearcoatStrength: 0.8,
    colorDepthFactor: 0.3,
  },
  {
    name: 'Racing Red',
    colors: definePresetColors({
      body: '#8b1a1a',
      secondary: CARBON,
      nose: '#8b1a1a',
      halo: TITANIUM,
      frontWing: '#8b1a1a',
      rearWing: '#8b1a1a',
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    }),
    flakeIntensity: 0.5,
    flakeScale: 900,
    clearcoatStrength: 0.85,
    colorDepthFactor: 0.35,
  },
  {
    name: 'British Green',
    colors: definePresetColors({
      body: '#0d3b1e',
      secondary: '#0d3b1e',
      nose: '#0d3b1e',
      halo: TITANIUM,
      frontWing: '#0d3b1e',
      rearWing: '#0d3b1e',
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    }),
    flakeIntensity: 0.35,
    flakeScale: 750,
    clearcoatStrength: 0.75,
    colorDepthFactor: 0.25,
  },
  {
    name: 'Papaya Orange',
    colors: definePresetColors({
      body: '#c45e1a',
      secondary: CARBON,
      nose: '#c45e1a',
      halo: TITANIUM,
      frontWing: '#c45e1a',
      rearWing: CARBON,
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    }),
    flakeIntensity: 0.45,
    flakeScale: 850,
    clearcoatStrength: 0.8,
    colorDepthFactor: 0.3,
  },
  {
    name: 'Silver Arrow',
    colors: definePresetColors({
      body: '#9a9a9a',
      secondary: '#5a5a5a',
      nose: '#9a9a9a',
      halo: '#c0c0c0',
      frontWing: '#9a9a9a',
      rearWing: '#9a9a9a',
      mirrors: '#5a5a5a',
      brackets: '#5a5a5a',
      wheelCovers: '#5a5a5a',
    }),
    materialSettings: normalizePartMaterialSettings({
      body: { roughness: 0.22, metalness: 0.72 },
      secondary: { roughness: 0.3, metalness: 0.58 },
      nose: { roughness: 0.22, metalness: 0.72 },
      halo: { roughness: 0.18, metalness: 0.82 },
      frontWing: { roughness: 0.24, metalness: 0.68 },
      rearWing: { roughness: 0.24, metalness: 0.68 },
      mirrors: { roughness: 0.32, metalness: 0.55 },
      brackets: { roughness: 0.32, metalness: 0.55 },
      wheelCovers: { roughness: 0.3, metalness: 0.6 },
    }),
    flakeIntensity: 0.6,
    flakeScale: 1000,
    clearcoatStrength: 0.9,
    colorDepthFactor: 0.15,
  },
  {
    name: 'Gulf Livery',
    colors: definePresetColors({
      body: '#6bb7d8',
      secondary: CARBON,
      nose: '#6bb7d8',
      halo: TITANIUM,
      frontWing: '#c45e1a',
      rearWing: '#c45e1a',
      mirrors: '#c45e1a',
      brackets: CARBON,
      wheelCovers: CARBON,
    }),
    flakeIntensity: 0.3,
    flakeScale: 700,
    clearcoatStrength: 0.7,
    colorDepthFactor: 0.2,
  },
  {
    name: 'Matte Black',
    colors: definePresetColors({
      body: CARBON,
      secondary: CARBON,
      nose: CARBON,
      halo: CARBON,
      frontWing: CARBON,
      rearWing: CARBON,
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    }),
    materialSettings: normalizePartMaterialSettings({
      body: { roughness: 0.78, metalness: 0.08 },
      secondary: { roughness: 0.82, metalness: 0.06 },
      nose: { roughness: 0.78, metalness: 0.08 },
      halo: { roughness: 0.8, metalness: 0.08 },
      frontWing: { roughness: 0.8, metalness: 0.08 },
      rearWing: { roughness: 0.8, metalness: 0.08 },
      mirrors: { roughness: 0.85, metalness: 0.05 },
      brackets: { roughness: 0.85, metalness: 0.05 },
      wheelCovers: { roughness: 0.78, metalness: 0.08 },
    }),
    flakeIntensity: 0.1,
    flakeScale: 600,
    clearcoatStrength: 0.3,
    colorDepthFactor: 0.4,
  },
  {
    name: 'Pearl White',
    colors: definePresetColors({
      body: '#e8e4df',
      secondary: '#e8e4df',
      nose: '#e8e4df',
      halo: '#c0c0c0',
      frontWing: '#e8e4df',
      rearWing: '#e8e4df',
      mirrors: '#e8e4df',
      brackets: '#c0c0c0',
      wheelCovers: '#c0c0c0',
    }),
    materialSettings: normalizePartMaterialSettings({
      body: { roughness: 0.26, metalness: 0.18 },
      secondary: { roughness: 0.26, metalness: 0.18 },
      nose: { roughness: 0.26, metalness: 0.18 },
      halo: { roughness: 0.22, metalness: 0.48 },
      frontWing: { roughness: 0.28, metalness: 0.16 },
      rearWing: { roughness: 0.28, metalness: 0.16 },
      mirrors: { roughness: 0.28, metalness: 0.16 },
      brackets: { roughness: 0.24, metalness: 0.42 },
      wheelCovers: { roughness: 0.24, metalness: 0.42 },
    }),
    flakeIntensity: 0.55,
    flakeScale: 950,
    clearcoatStrength: 0.85,
    colorDepthFactor: 0.1,
  },
  {
    name: 'Candy Purple',
    colors: definePresetColors({
      body: '#4a1a6b',
      secondary: CARBON,
      nose: '#4a1a6b',
      halo: TITANIUM,
      frontWing: '#4a1a6b',
      rearWing: '#4a1a6b',
      mirrors: CARBON,
      brackets: CARBON,
      wheelCovers: CARBON,
    }),
    flakeIntensity: 0.5,
    flakeScale: 850,
    clearcoatStrength: 0.8,
    colorDepthFactor: 0.35,
  },
  {
    name: 'Champagne Gold',
    colors: definePresetColors({
      body: '#b8965a',
      secondary: '#2a2018',
      nose: '#b8965a',
      halo: '#b8965a',
      frontWing: '#b8965a',
      rearWing: '#2a2018',
      mirrors: '#2a2018',
      brackets: '#2a2018',
      wheelCovers: '#2a2018',
    }),
    materialSettings: normalizePartMaterialSettings({
      body: { roughness: 0.2, metalness: 0.82 },
      secondary: { roughness: 0.38, metalness: 0.35 },
      nose: { roughness: 0.2, metalness: 0.82 },
      halo: { roughness: 0.18, metalness: 0.86 },
      frontWing: { roughness: 0.22, metalness: 0.78 },
      rearWing: { roughness: 0.36, metalness: 0.38 },
      mirrors: { roughness: 0.36, metalness: 0.38 },
      brackets: { roughness: 0.42, metalness: 0.32 },
      wheelCovers: { roughness: 0.38, metalness: 0.35 },
    }),
    flakeIntensity: 0.65,
    flakeScale: 1100,
    clearcoatStrength: 0.85,
    colorDepthFactor: 0.2,
  },
]

interface CarPaintState {
  partColors: Record<CarPartId, string>
  partMaterialSettings: Record<CarPartId, PartMaterialSettings>
  selectedPart: CarPartId | 'all'
  isolateSelected: boolean
  flakeIntensity: number
  flakeScale: number
  clearcoatStrength: number
  colorDepthFactor: number

  setPartColor: (partId: CarPartId, color: string) => void
  setAllColors: (color: string) => void
  setPartRoughness: (partId: CarPartId, roughness: number) => void
  setAllRoughness: (roughness: number) => void
  setPartMetalness: (partId: CarPartId, metalness: number) => void
  setAllMetalness: (metalness: number) => void
  setSelectedPart: (partId: CarPartId | 'all') => void
  setIsolateSelected: (v: boolean) => void
  setFlakeIntensity: (v: number) => void
  setFlakeScale: (v: number) => void
  setClearcoatStrength: (v: number) => void
  setColorDepthFactor: (v: number) => void
  applyPreset: (preset: CarPaintPreset) => void
  getColorForPart: (partId: CarPartId) => string
  getMaterialSettingsForPart: (partId: CarPartId) => PartMaterialSettings
  setActiveColor: (color: string) => void
  setActiveRoughness: (roughness: number) => void
  setActiveMetalness: (metalness: number) => void
}

const defaultPartColors: Record<CarPartId, string> = {
  body: DEFAULT_COLOR,
  engineCover: DEFAULT_COLOR,
  airHorn: DEFAULT_COLOR,
  sidepods: DEFAULT_COLOR,
  secondary: DEFAULT_COLOR,
  nose: DEFAULT_COLOR,
  cockpit: DEFAULT_COLOR,
  cockpitGlass: GLASS,
  cockpitInterior: CARBON,
  steeringWheel: CARBON,
  tcam: TITANIUM,
  cameras: CARBON,
  halo: TITANIUM,
  frontWing: DEFAULT_COLOR,
  frontWheelWinglets: CARBON,
  rearWing: DEFAULT_COLOR,
  rearLight: REAR_LIGHT,
  exhaust: CARBON,
  mirrors: CARBON,
  mirrorGlass: GLASS,
  brackets: CARBON,
  brakeHardware: CARBON,
  wheelPanels: CARBON,
  wheelCovers: CARBON,
}

const defaultPartMaterialSettings = normalizePartMaterialSettings()

export const useCarPaintStore = create<CarPaintState>()(
  persist(
    (set, get) => ({
      partColors: { ...defaultPartColors },
      partMaterialSettings: normalizePartMaterialSettings(),
      selectedPart: 'all' as CarPartId | 'all',
      isolateSelected: false,
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

      setPartRoughness: (partId, roughness) =>
        set(state => ({
          partMaterialSettings: {
            ...state.partMaterialSettings,
            [partId]: {
              ...state.partMaterialSettings[partId],
              roughness: clampMaterialValue(roughness),
            },
          },
        })),

      setAllRoughness: roughness =>
        set(state => {
          const partMaterialSettings = { ...state.partMaterialSettings }
          for (const id of ALL_PART_IDS) {
            partMaterialSettings[id] = {
              ...partMaterialSettings[id],
              roughness: clampMaterialValue(roughness),
            }
          }
          return { partMaterialSettings }
        }),

      setPartMetalness: (partId, metalness) =>
        set(state => ({
          partMaterialSettings: {
            ...state.partMaterialSettings,
            [partId]: {
              ...state.partMaterialSettings[partId],
              metalness: clampMaterialValue(metalness),
            },
          },
        })),

      setAllMetalness: metalness =>
        set(state => {
          const partMaterialSettings = { ...state.partMaterialSettings }
          for (const id of ALL_PART_IDS) {
            partMaterialSettings[id] = {
              ...partMaterialSettings[id],
              metalness: clampMaterialValue(metalness),
            }
          }
          return { partMaterialSettings }
        }),

      setSelectedPart: selectedPart =>
        set(state => ({
          selectedPart,
          isolateSelected: selectedPart === 'all' ? false : state.isolateSelected,
        })),

      setIsolateSelected: isolateSelected => set({ isolateSelected }),

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
            partMaterialSettings: normalizePartMaterialSettings(preset.materialSettings),
            flakeIntensity: preset.flakeIntensity,
            flakeScale: preset.flakeScale,
            clearcoatStrength: preset.clearcoatStrength,
            colorDepthFactor: preset.colorDepthFactor,
          }
        }),

      getColorForPart: (partId: CarPartId) => get().partColors[partId] ?? DEFAULT_COLOR,
      getMaterialSettingsForPart: (partId: CarPartId) =>
        get().partMaterialSettings[partId] ?? defaultPartMaterialSettings[partId],

      setActiveColor: color => {
        const { selectedPart } = get()
        if (selectedPart === 'all') {
          get().setAllColors(color)
        } else {
          get().setPartColor(selectedPart, color)
        }
      },

      setActiveRoughness: roughness => {
        const { selectedPart } = get()
        if (selectedPart === 'all') {
          get().setAllRoughness(roughness)
        } else {
          get().setPartRoughness(selectedPart, roughness)
        }
      },

      setActiveMetalness: metalness => {
        const { selectedPart } = get()
        if (selectedPart === 'all') {
          get().setAllMetalness(metalness)
        } else {
          get().setPartMetalness(selectedPart, metalness)
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
        partMaterialSettings: state.partMaterialSettings,
      }),
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<CarPaintState>) }
        return {
          ...state,
          partColors: { ...defaultPartColors, ...state.partColors },
          partMaterialSettings: normalizePartMaterialSettings(state.partMaterialSettings),
        }
      },
    },
  ),
)
