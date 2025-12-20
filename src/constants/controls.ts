// Keyboard control mappings for the game (used by @react-three/drei KeyboardControls)
export const keyboardMap = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] },
  { name: 'backward', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] },
  { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'brake', keys: ['Space'] },
  { name: 'ers', keys: ['KeyB'] },
  { name: 'ersPreset', keys: ['KeyG'] },
  { name: 'overtake', keys: ['KeyR'] },
  { name: 'aero', keys: ['KeyV'] },
  { name: 'brakeIncr', keys: ['BracketRight'] },
  { name: 'brakeDecr', keys: ['BracketLeft'] },
  { name: 'camera', keys: ['KeyC'] },
  { name: 'heatmap', keys: ['KeyH'] },
  { name: 'distanceGrid', keys: ['AltLeft', 'AltRight'] },
  { name: 'freeCamera', keys: ['KeyF'] },
]

// Control categories for KeymapModal
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
  movement: { label: 'Movement', color: '#4ade80' },
  drivingSystems: { label: 'Driving Systems', color: '#60a5fa' },
  camera: { label: 'Camera', color: '#c084fc' },
  racingMode: { label: 'Racing', color: '#f59e0b' },
  testingMode: { label: 'Testing', color: '#ef4444' },
}

export const CONTROLS: ControlDefinition[] = [
  // Movement
  { id: 'forward', displayName: 'Accelerate', keys: ['W', '↑'], category: 'movement' },
  { id: 'backward', displayName: 'Brake/Reverse', keys: ['S', '↓'], category: 'movement' },
  { id: 'left', displayName: 'Steer Left', keys: ['A', '←'], category: 'movement' },
  { id: 'right', displayName: 'Steer Right', keys: ['D', '→'], category: 'movement' },
  { id: 'brake', displayName: 'Handbrake', keys: ['Space'], category: 'movement' },

  // Driving Systems
  { id: 'ers', displayName: 'Cycle ERS', keys: ['B'], category: 'drivingSystems' },
  { id: 'ersPreset', displayName: 'ERS Preset', keys: ['G'], category: 'drivingSystems' },
  {
    id: 'overtake',
    displayName: 'Overtake',
    keys: ['R'],
    category: 'drivingSystems',
    testingModeOnly: true,
  },
  { id: 'aero', displayName: 'Aero Mode', keys: ['V'], category: 'drivingSystems' },
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
  { id: 'trackEditor', displayName: 'Track Editor', keys: ['T'], category: 'racingMode' },

  // Testing (gated by testing mode)
  {
    id: 'cycleWeather',
    displayName: 'Cycle Weather',
    keys: ['Q'],
    category: 'testingMode',
    testingModeOnly: true,
  },
  {
    id: 'envSettings',
    displayName: 'Environment',
    keys: ['Shift', 'E'],
    category: 'testingMode',
    testingModeOnly: true,
  },
  {
    id: 'heatmap',
    displayName: 'Heatmap',
    keys: ['H'],
    category: 'testingMode',
    testingModeOnly: true,
  },
  {
    id: 'distanceGrid',
    displayName: 'Distance Grid',
    keys: ['Alt'],
    category: 'testingMode',
    testingModeOnly: true,
  },
  {
    id: 'debugPanel',
    displayName: 'Debug Panel',
    keys: ['`'],
    category: 'testingMode',
    testingModeOnly: true,
  },
  {
    id: 'toggleTestingMode',
    displayName: 'Testing Mode',
    keys: ['Shift', '\\'],
    category: 'testingMode',
  },
]

export function getControlsByCategory(category: ControlCategory): ControlDefinition[] {
  return CONTROLS.filter(c => c.category === category)
}
