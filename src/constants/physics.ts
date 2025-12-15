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

// Speed conversion
export const MS_TO_KMH = 3.6
export const KMH_TO_MS = 1 / 3.6

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

// DRS (Drag Reduction System) configuration
export const DRS_CONFIG = {
  // Minimum speed to activate DRS (km/h)
  activationSpeed: 200,
  // Drag reduction when DRS active (0.4 = 60% less drag)
  dragMultiplier: 0.4,
  // Extra engine force boost in DRS zone (200-300 km/h)
  engineBoostLow: 4000, // Extra N at 200 km/h
  engineBoostHigh: 8000, // Extra N at 300 km/h (more boost needed against drag)
  // Speed range for boost scaling
  boostStartSpeed: 200, // km/h
  boostEndSpeed: 300, // km/h
  // Downforce reduction (less downforce = less drag, but less grip)
  downforceMultiplier: 0.6,
} as const

// Drift physics configuration
export const DRIFT_CONFIG = {
  // Handbrake reduces rear grip to this multiplier (0.2 = 20% grip)
  handbrakeRearGripMultiplier: 0.2,
  // Slip angle threshold to enter drift state (degrees)
  driftEntrySlipAngle: 15,
  // Slip angle to exit drift state (degrees)
  driftExitSlipAngle: 8,
  // Lateral correction during drift (lower = more slide)
  driftLateralCorrection: 0.55,
  // Normal lateral correction
  normalLateralCorrection: 0.92,
  // Max angular velocity during drift (rad/s)
  driftMaxAngularVelocity: 2.8,
  // Normal max angular velocity (rad/s)
  normalMaxAngularVelocity: 1.2,
  // Throttle oversteer factor (how much throttle breaks rear grip in turns)
  throttleOversteerFactor: 0.35,
  // Minimum speed for drifting (km/h)
  minDriftSpeed: 30,
  // Countersteer assistance strength
  countersteerAssist: 0.3,
} as const
