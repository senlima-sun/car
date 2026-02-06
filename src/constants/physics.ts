export const CAR_SCALE = 1.47

export const VEHICLE_CONFIG = {
  wheels: {
    radius: 0.3,
    width: 0.35,
    positions: [
      [-0.82, 0, 1.8] as const,
      [0.82, 0, 1.8] as const,
      [-0.82, 0, -1.2] as const,
      [0.82, 0, -1.2] as const,
    ],
  },
}

// Control keys
export const CONTROLS = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  toggleCamera: 'KeyC',
  brake: 'Space',
  drs: 'KeyE',
} as const
