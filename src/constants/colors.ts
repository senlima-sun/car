// =============================================================================
// Semantic Color Constants
// =============================================================================
// All colors used throughout the application with meaningful names.
// Colors are organized by their purpose/context rather than by hue.

// =============================================================================
// STATUS COLORS - For indicators, feedback, and state
// =============================================================================
export const STATUS = {
  // Success states - good, active, OK
  success: '#22c55e', // Primary green
  successLight: '#4ade80', // Lighter green variant

  // Warning states - caution, attention needed
  warning: '#f59e0b', // Primary amber/orange
  warningLight: '#facc15', // Lighter yellow variant

  // Danger states - error, critical, stop
  danger: '#ef4444', // Primary red
  dangerLight: '#f87171', // Lighter red variant
  dangerDark: '#dc2626', // Darker red for emphasis

  // Info states - informational, neutral action
  info: '#3b82f6', // Primary blue

  // Neutral states
  neutral: '#ffffff', // White - balanced/default state
} as const

// =============================================================================
// ERS MODE COLORS - Energy Recovery System modes
// =============================================================================
export const ERS_MODE = {
  attack: '#22c55e', // Green - deploying power
  balanced: '#ffffff', // White - neutral
  harvest: '#3b82f6', // Blue - regenerating
  overtake: '#f97316', // Orange - maximum power
  semiAuto: '#a855f7', // Purple - automatic/smart mode
  superClip: '#a855f7', // Purple - same as semi-auto for special mode
} as const

// =============================================================================
// AERO MODE COLORS - Aerodynamic configuration
// =============================================================================
export const AERO_MODE = {
  corner: '#3b82f6', // Blue - high downforce
  straight: '#22c55e', // Green - low drag
} as const

// =============================================================================
// ENGINE BRAKING COLORS
// =============================================================================
export const ENGINE_BRAKING = {
  low: '#3b82f6', // Blue - minimal engine braking
  medium: '#22c55e', // Green - balanced
  high: '#f97316', // Orange - aggressive
} as const

// =============================================================================
// BRAKE BIAS COLORS
// =============================================================================
export const BRAKE_BIAS = {
  front: '#f97316', // Orange - more front brake
  balanced: '#22c55e', // Green - balanced
  rear: '#3b82f6', // Blue - more rear brake
} as const

// =============================================================================
// GEAR INDICATOR COLORS
// =============================================================================
export const GEAR = {
  redline: '#ff0000', // Pure red - at rev limit
  reverse: '#ef4444', // Red - reverse gear
  neutral: '#f59e0b', // Amber - neutral
  normal: '#ffffff', // White - forward gears
  reverseAlt: '#ff9f43', // Orange-red variant for reverse
} as const

// =============================================================================
// PERFORMANCE INDICATOR COLORS - FPS, temperature, wear
// =============================================================================
export const PERFORMANCE = {
  // FPS colors
  fpsGood: '#4ade80', // Green - 50+ FPS
  fpsWarning: '#facc15', // Yellow - 30-50 FPS
  fpsBad: '#f87171', // Red - <30 FPS

  // Temperature colors
  tempNormal: '#22c55e', // Green - normal operating temp
  tempHigh: '#f59e0b', // Orange - elevated temp
  tempCritical: '#ef4444', // Red - dangerous temp
  tempCold: '#3b82f6', // Blue - below optimal

  // Wear colors (tires, brakes, etc.)
  wearGood: '#22c55e', // Green - low wear
  wearWarning: '#f59e0b', // Orange - moderate wear
  wearCritical: '#ef4444', // Red - high wear

  // Grip colors
  gripGood: '#22c55e', // Green - good grip
  gripWarning: '#f59e0b', // Orange - reduced grip
  gripBad: '#ef4444', // Red - poor grip
} as const

// =============================================================================
// TIRE COMPOUND COLORS
// =============================================================================
export const TIRE_COMPOUND = {
  soft: '#dc2626', // Red
  medium: '#eab308', // Yellow
  hard: '#ffffff', // White
  wet: '#2563eb', // Blue
  intermediate: '#22c55e', // Green
} as const

// =============================================================================
// TEMPERATURE HEATMAP COLORS - For track/surface visualization
// =============================================================================
export const HEATMAP = {
  deepCold: '#1a3399', // Deep blue
  cold: '#3380e6', // Blue
  moderate: '#33cc4d', // Green
  warm: '#ff991a', // Orange
  hot: '#ff261a', // Red

  // Additional heatmap indicators
  windGusting: '#ffaa33', // Orange for wind gusts
  infoHighlight: '#6bb8ff', // Light blue for info
} as const

// =============================================================================
// LAP TIMER COLORS
// =============================================================================
export const LAP_TIMER = {
  recording: '#ff4444', // Red - actively recording
  bestLap: '#00ff88', // Bright green - personal best
  currentLap: '#ffffff', // White - current lap
  ghost: '#ff00ff', // Magenta - ghost lap comparison
  label: '#888888', // Gray - labels and headers
  muted: '#666666', // Dark gray - secondary info
} as const

// =============================================================================
// UI SURFACE COLORS - Backgrounds, panels, text
// =============================================================================
export const UI = {
  // Backgrounds
  backgroundDark: '#1a1a2e', // App background
  backgroundMid: '#252538', // Panel background
  surface: '#2a2a2a', // Card/surface background
  surfaceLight: '#3a3a50', // Elevated surface

  // Borders
  border: '#3a3a50', // Default border
  borderLight: '#4a4a60', // Light border
  borderActive: '#8888ff', // Active/focused border

  // Text colors
  textPrimary: '#ffffff', // Primary text
  textSecondary: '#aaaaaa', // Secondary text
  textMuted: '#888888', // Muted/subtle text
  textDisabled: '#666666', // Disabled text

  // Interactive states
  hoverBackground: '#4a4a70', // Hover state
  activeBackground: '#5a5a80', // Active/selected state
} as const

// =============================================================================
// TRACK OBJECT COLORS - Editor and 3D scene elements
// =============================================================================
export const TRACK_OBJECT = {
  // Object types
  cone: '#ff6b00', // Orange safety cone
  ramp: '#ffcc00', // Yellow ramp
  checkpoint: '#00ff00', // Green checkpoint
  barrier: '#666666', // Gray barrier
  barrierAlt: '#888888', // Alternate barrier shade
  road: '#333333', // Dark gray road
  curb: '#ff0000', // Red curb (primary)
  curbAlt: '#ffffff', // White curb (alternating)
  pitLane: '#ff6600', // Orange pit lane markings
  pitAsphalt: '#2a2a2a', // Pit lane surface
  pitAsphaltDark: '#1a1a1a', // Darker pit lane surface

  // Ghost preview colors
  ghostValid: '#00ff00', // Green - valid placement
  ghostInvalid: '#ff0000', // Red - invalid placement
  ghostActive: '#00ffff', // Cyan - active/editable
  ghostInactive: '#888888', // Gray - inactive
  ghostConnection: '#ffaa00', // Orange - connection points

  // Selection colors
  selectionHighlight: '#ff4444', // Red selection outline
  selectionFill: '#ff0000', // Red selection fill (transparent)

  // Road markings
  roadLine: '#ffffff', // White road lines
  roadCenterLine: '#ffcc00', // Yellow center line
  startLine: '#22c55e', // Green start/finish area

  // Distance markers
  distanceMarker: '#ff6600', // Orange distance marker
  distanceMarkerAlt: '#ffffff', // White distance marker
} as const

// =============================================================================
// MATERIAL COLORS - 3D materials and surfaces
// =============================================================================
export const MATERIAL = {
  // Carbon fiber shades
  carbonDark: '#1a1a1a', // Darkest carbon
  carbonMid: '#2a2a2a', // Medium carbon
  carbonLight: '#3a3a3a', // Lighter carbon
  carbonLightest: '#4a4a4a', // Lightest carbon

  // Metal shades
  metalVeryDark: '#111111', // Very dark metal
  metalDark: '#444444', // Dark metal
  metalMid: '#555555', // Medium metal
  metalLight: '#999999', // Light metal
  metalBright: '#c0c0c0', // Bright metal
  metalBrightest: '#d0d0d0', // Brightest metal

  // General surfaces
  rubber: '#1a1a1a', // Tire rubber
  grass: ['#3d7a2d', '#2d5a1d'] as const, // Grass gradient
  asphalt: '#2a2a2a', // Road surface

  // Car frame
  frame: '#222222',
  cockpit: '#555555',
} as const

// =============================================================================
// RPM INDICATOR COLORS - Rev counter lights
// =============================================================================
export const RPM_LIGHTS = {
  green: '#00ff00', // Lower RPM zone
  red: '#ff0000', // Mid-high RPM zone
  blue: '#0000ff', // High RPM zone (shift indicator)
  off: '#111111', // Inactive light
} as const

// =============================================================================
// WEATHER LIGHTING COLORS
// =============================================================================
export const WEATHER_LIGHTING = {
  // Rain effects
  rainDrop: '#aaccff', // Light blue rain
  rainDropLight: '#aaccee', // Lighter rain variant
  mist: '#e8f0ff', // White mist
  mistLight: '#e8f4ff', // Lighter mist
  spray: '#c8dce8', // Road spray
  sprayLight: '#d0e8f0', // Light spray

  // Puddle colors
  puddleShallow: '#5080a0', // Shallow water
  puddleDeep: '#203850', // Deep water
  puddleSurface: '#2a4050', // Puddle surface

  // Lightning
  lightning: '#e0e8ff', // Lightning flash

  // Dust/Heat effects
  heatHaze: '#ffcc88', // Hot weather particles
  fogDark: '#3a4550', // Dark fog

  // Standard lighting
  white: '#ffffff', // Pure white light
} as const

// =============================================================================
// CONTROL CATEGORY COLORS - For keymap/control display
// =============================================================================
export const CONTROL_CATEGORY = {
  movement: '#4ade80', // Green
  drivingSystems: '#60a5fa', // Blue
  camera: '#c084fc', // Purple
  racingMode: '#f59e0b', // Amber
  testingMode: '#ef4444', // Red
} as const

// =============================================================================
// EDITOR COLORS - Part editor, track editor
// =============================================================================
export const EDITOR = {
  // Grid
  gridCell: '#444444',
  gridSection: '#666666',

  // Selection
  selection: '#00ff00', // Green selection
  hover: '#ffff00', // Yellow hover
  outline: '#6699ff', // Blue outline
  hole: '#ff6666', // Red for holes

  // Points and handles
  pointDefault: '#ffffff', // White point
  pointHover: '#ff6666', // Red hover
  pointDrag: '#ffcc00', // Yellow dragging
  pointEndpoint: '#ff9944', // Orange endpoint

  // Reference elements
  reference: '#4488ff', // Blue reference
  referenceFill: '#335588', // Reference fill

  // Buttons
  actionPrimary: '#3a5070', // Blue action
  actionDanger: '#703a3a', // Red action
  actionSuccess: '#3a6050', // Green action
} as const

// =============================================================================
// BUTTON COLORS - UI buttons
// =============================================================================
export const BUTTON = {
  primary: '#2563eb', // Blue
  success: '#22c55e', // Green
  danger: '#dc2626', // Red
  warning: '#f59e0b', // Amber
  purple: '#8b5cf6', // Purple
  gray: '#666666', // Neutral gray
} as const

// =============================================================================
// MOBILE CONTROLS COLORS
// =============================================================================
export const MOBILE = {
  accelerate: '#00ff88', // Green accelerate
  brake: '#ff4444', // Red brake
  speed: '#00ff88', // Speed display
  reverse: '#ff6b6b', // Reverse indicator
  reverseLabel: '#ff9f43', // Reverse label
  label: '#888888', // General labels
} as const

// =============================================================================
// AQUAPLANING INDICATOR COLORS
// =============================================================================
export const AQUAPLANING = {
  danger: {
    border: '#ff4444',
    text: '#ffffff',
    subtext: '#ffcccc',
  },
  warning: {
    border: '#ffffff',
    text: '#ffffff',
  },
  info: {
    border: '#6666ff',
    text: '#ffffff',
    subtext: '#ccccff',
  },
} as const
