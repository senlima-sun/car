import { CONTROL_CATEGORY } from './colors'

// Keyboard control mappings for the game (used by @react-three/drei KeyboardControls)
export const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'handbrake', keys: ['Space'] },
  { name: 'ersPreset', keys: ['KeyG'] },
  { name: 'overtake', keys: ['KeyR'] },
  { name: 'aero', keys: ['KeyK'] },
  { name: 'aeroAuto', keys: ['KeyE'] },
  { name: 'brakeIncr', keys: ['BracketRight'] },
  { name: 'brakeDecr', keys: ['BracketLeft'] },
  { name: 'camera', keys: ['KeyC'] },
  { name: 'windView', keys: ['KeyH'] },
  { name: 'freeCamera', keys: ['KeyF'] },
  { name: 'lapTimer', keys: ['KeyL'] },
  { name: 'pitStop', keys: ['KeyP'] },
]

export type ControlCategory =
  | 'movement'
  | 'drivingSystems'
  | 'camera'
  | 'racingMode'
  | 'testingMode'

export interface ControlDefinition {
  id: string
  displayName: string
  keys: string[]
  category: ControlCategory
  testingModeOnly?: boolean
}

export const CONTROL_CATEGORIES: Record<ControlCategory, { label: string; color: string }> = {
  movement: { label: 'Movement', color: CONTROL_CATEGORY.movement },
  drivingSystems: { label: 'Driving Systems', color: CONTROL_CATEGORY.drivingSystems },
  camera: { label: 'Camera', color: CONTROL_CATEGORY.camera },
  racingMode: { label: 'Racing', color: CONTROL_CATEGORY.racingMode },
  testingMode: { label: 'Testing', color: CONTROL_CATEGORY.testingMode },
}

export const CONTROLS: ControlDefinition[] = [
  // Movement
  { id: 'forward', displayName: 'Accelerate', keys: ['W', '↑'], category: 'movement' },
  { id: 'backward', displayName: 'Brake', keys: ['S', '↓'], category: 'movement' },
  { id: 'left', displayName: 'Steer Left', keys: ['A', '←'], category: 'movement' },
  { id: 'right', displayName: 'Steer Right', keys: ['D', '→'], category: 'movement' },
  { id: 'handbrake', displayName: 'Handbrake', keys: ['Space'], category: 'movement' },

  // Driving Systems
  { id: 'ersPreset', displayName: 'ERS Auto Preset', keys: ['G'], category: 'drivingSystems' },
  {
    id: 'overtake',
    displayName: 'Overtake',
    keys: ['R'],
    category: 'drivingSystems',
    testingModeOnly: true,
  },
  { id: 'aero', displayName: 'Aero Mode', keys: ['K'], category: 'drivingSystems' },
  { id: 'aeroAuto', displayName: 'Auto Aero', keys: ['E'], category: 'drivingSystems' },
  {
    id: 'brakeIncr',
    displayName: 'Brake Bias +',
    keys: [']'],
    category: 'drivingSystems',
    testingModeOnly: true,
  },
  {
    id: 'brakeDecr',
    displayName: 'Brake Bias -',
    keys: ['['],
    category: 'drivingSystems',
    testingModeOnly: true,
  },

  // Camera
  { id: 'camera', displayName: 'Toggle Camera', keys: ['C'], category: 'camera' },
  {
    id: 'freeCamera',
    displayName: 'Free Camera',
    keys: ['F'],
    category: 'camera',
    testingModeOnly: true,
  },

  // Racing
  { id: 'lapTimer', displayName: 'Lap Timer', keys: ['L'], category: 'racingMode' },
  { id: 'pitStop', displayName: 'Pit Stop', keys: ['P'], category: 'racingMode' },
  { id: 'settings', displayName: 'Settings / Help', keys: ['Esc'], category: 'racingMode' },

  // Testing (gated by testing mode)
  {
    id: 'envSettings',
    displayName: 'Environment',
    keys: ['M'],
    category: 'testingMode',
    testingModeOnly: true,
  },
  {
    id: 'windView',
    displayName: 'Wind View',
    keys: ['H'],
    category: 'testingMode',
    testingModeOnly: true,
  },
]

export function getControlsByCategory(category: ControlCategory): ControlDefinition[] {
  return CONTROLS.filter(c => c.category === category)
}
