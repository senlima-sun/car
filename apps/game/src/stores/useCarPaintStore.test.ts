import { beforeEach, describe, expect, test } from 'bun:test'
import {
  CAR_PARTS,
  DEFAULT_PART_MATERIAL_SETTINGS,
  PAINT_PRESETS,
  getPartIdForMesh,
  useCarPaintStore,
} from './useCarPaintStore'

function resetPaintStore() {
  const store = useCarPaintStore.getState()
  store.setSelectedPart('all')
  store.setAllRoughness(0.35)
  store.setAllMetalness(0.4)
  store.setFlakeIntensity(0.4)
  store.setFlakeScale(800)
  store.setClearcoatStrength(0.8)
  store.setColorDepthFactor(0.3)
}

describe('useCarPaintStore material settings', () => {
  beforeEach(() => {
    resetPaintStore()
  })

  test('updates roughness and metalness for the selected part only', () => {
    const store = useCarPaintStore.getState()

    store.setSelectedPart('nose')
    store.setActiveRoughness(0.72)
    store.setActiveMetalness(0.18)

    const state = useCarPaintStore.getState()
    expect(state.partMaterialSettings.nose).toEqual({ roughness: 0.72, metalness: 0.18 })
    expect(state.partMaterialSettings.body).toEqual({ roughness: 0.35, metalness: 0.4 })
  })

  test('updates every part when all parts are selected and clamps values', () => {
    const store = useCarPaintStore.getState()

    store.setSelectedPart('all')
    store.setActiveRoughness(-1)
    store.setActiveMetalness(2)

    const state = useCarPaintStore.getState()
    for (const part of CAR_PARTS) {
      expect(state.partMaterialSettings[part.id]).toEqual({ roughness: 0, metalness: 1 })
    }
  })

  test('applies preset material settings when a preset defines them', () => {
    const silverArrow = PAINT_PRESETS.find(preset => preset.name === 'Silver Arrow')
    expect(silverArrow).toBeDefined()

    useCarPaintStore.getState().applyPreset(silverArrow!)

    const state = useCarPaintStore.getState()
    expect(state.partMaterialSettings.body).toEqual({ roughness: 0.22, metalness: 0.72 })
    expect(state.partMaterialSettings.halo).toEqual({ roughness: 0.18, metalness: 0.82 })
    expect(state.partMaterialSettings.engineCover).toEqual(DEFAULT_PART_MATERIAL_SETTINGS)
    expect(state.partMaterialSettings.airHorn).toEqual(DEFAULT_PART_MATERIAL_SETTINGS)
  })

  test('resets material settings when a preset omits them', () => {
    const matteBlack = PAINT_PRESETS.find(preset => preset.name === 'Matte Black')
    const racingRed = PAINT_PRESETS.find(preset => preset.name === 'Racing Red')
    expect(matteBlack).toBeDefined()
    expect(racingRed).toBeDefined()

    const store = useCarPaintStore.getState()
    store.applyPreset(matteBlack!)
    store.applyPreset(racingRed!)

    const state = useCarPaintStore.getState()
    for (const part of CAR_PARTS) {
      expect(state.partMaterialSettings[part.id]).toEqual(DEFAULT_PART_MATERIAL_SETTINGS)
    }
  })

  test('maps normalized car model meshes to paintable parts', () => {
    expect(getPartIdForMesh('Body_Generic_Shell')).toBe('body')
    expect(getPartIdForMesh('Car_Livery_EngineCover_L')).toBe('engineCover')
    expect(getPartIdForMesh('Car_Livery_EngineCover_L_1')).toBe('engineCover')
    expect(getPartIdForMesh('Body_Airbox_Horn')).toBe('airHorn')
    expect(getPartIdForMesh('Car_Livery_Sidepod_L')).toBe('sidepods')
    expect(getPartIdForMesh('Car_Livery_1001')).toBe('secondary')
    expect(getPartIdForMesh('Car_Livery_1001_1')).toBe('secondary')
    expect(getPartIdForMesh('Floor_Carbon_Shell')).toBe('secondary')
    expect(getPartIdForMesh('Car_Livery_CockpitSurround')).toBe('cockpit')
    expect(getPartIdForMesh('Cockpit_Glass')).toBe('cockpitGlass')
    expect(getPartIdForMesh('Cockpit_Plastic_Interior')).toBe('cockpitInterior')
    expect(getPartIdForMesh('SteeringWheel_Frame')).toBe('steeringWheel')
    expect(getPartIdForMesh('TCam')).toBe('tcam')
    expect(getPartIdForMesh('Nose_Camera')).toBe('cameras')
    expect(getPartIdForMesh('FrontWing_MainAssembly')).toBe('frontWing')
    expect(getPartIdForMesh('FrontWheelWinglet_L')).toBe('frontWheelWinglets')
    expect(getPartIdForMesh('Car_Livery_BW-L')).toBe('rearWing')
    expect(getPartIdForMesh('Rear_Light')).toBe('rearLight')
    expect(getPartIdForMesh('Exhaust_Tailpipe')).toBe('exhaust')
    expect(getPartIdForMesh('Mirror_Glass_L')).toBe('mirrorGlass')
    expect(getPartIdForMesh('Suspension_Front_Wishbone_L')).toBe('brackets')
    expect(getPartIdForMesh('BrakeDisc_Front_Pair')).toBe('brakeHardware')
    expect(getPartIdForMesh('WheelPanel_FL')).toBe('wheelPanels')
    expect(getPartIdForMesh('WheelHub_FL')).toBe('wheelCovers')
  })

  test('derives fine-grained preset colors from broad legacy part colors', () => {
    const racingRed = PAINT_PRESETS.find(preset => preset.name === 'Racing Red')
    expect(racingRed).toBeDefined()

    useCarPaintStore.getState().applyPreset(racingRed!)

    const state = useCarPaintStore.getState()
    expect(state.partColors.engineCover).toBe('#8b1a1a')
    expect(state.partColors.airHorn).toBe('#8b1a1a')
    expect(state.partColors.sidepods).toBe('#8b1a1a')
    expect(state.partColors.cockpit).toBe('#8b1a1a')
    expect(state.partColors.cockpitGlass).toBe('#101820')
    expect(state.partColors.steeringWheel).toBe('#1a1a1a')
    expect(state.partColors.tcam).toBe('#8a8a8a')
    expect(state.partColors.rearLight).toBe('#c92c2c')
    expect(state.partColors.brakeHardware).toBe('#1a1a1a')
  })
})
