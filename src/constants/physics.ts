// Vehicle physics configuration
export const VEHICLE_CONFIG = {
  chassis: {
    mass: 1200, // kg
    width: 2.15, // meters (track width) - wider stance
    height: 0.5, // meters
    length: 4.5, // meters
    cgHeight: 0.35, // Center of gravity height (low for racing)
    weightDistFront: 0.47, // 47% front weight (mid-engine)
  },
  wheels: {
    radius: 0.33, // meters - racing wheel
    width: 0.28, // meters
    suspensionRestLength: 0.25,
    suspensionStiffness: 85, // N/m - stiff racing suspension
    suspensionDamping: 8.5,
    frictionSlip: 1.7, // Racing slicks on asphalt
    rollInfluence: 0.02,
    // Positions relative to chassis center [x, y, z]
    positions: [
      [-1.075, 0, 1.75] as const, // Front-left
      [1.075, 0, 1.75] as const, // Front-right
      [-1.075, 0, -1.35] as const, // Rear-left
      [1.075, 0, -1.35] as const, // Rear-right
    ],
  },
  engine: {
    maxForce: 12000, // N at low speed
    maxBrakeForce: 35000, // N - carbon ceramic brakes
    maxReverseForce: 3600,
    maxSteerAngle: 32 * (Math.PI / 180), // 32 degrees at low speed
    minSteerAngle: 6 * (Math.PI / 180), // 6 degrees at high speed
    steerSpeed: 3.2, // rad/s
    accelerationCurve: 1.0,
  },
  aero: {
    dragCoefficient: 0.35,
    downforceCoefficient: 2.8,
    frontalArea: 2.0, // m²
    downforceFrontBias: 0.45,
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
  handbrake: 'Shift',
  drs: 'KeyE',
} as const
