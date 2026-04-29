export const MIN_SPEED_FOR_SPRAY = 8

export const SPRAY_COUNT = 800
export const MIST_COUNT = 600
export const DROPLET_COUNT = 200

export const SURFACE_SAMPLE_EVERY = 15

export const WHEEL_POSITIONS = [
  { x: -0.95, z: 1.6, isRear: false },
  { x: 0.95, z: 1.6, isRear: false },
  { x: -0.95, z: -1.2, isRear: true },
  { x: 0.95, z: -1.2, isRear: true },
] as const
