// 1 world unit = 1 meter
// Reference: F1 car ~5.7m long, 2.0m wide, 0.95m high

export const CAR_LENGTH = 5.7
export const CAR_WIDTH = 2.0
export const CAR_HEIGHT = 1.0

export const WHEEL_RADIUS = 0.33
export const WHEEL_WIDTH = 0.30
export const WHEELBASE = 3.6
export const TRACK_GAUGE = 1.8
export const CG_HEIGHT = 0.35

export const TRACK_WIDTH = 12
export const ROAD_THICKNESS = 0.15
export const CURB_WIDTH = 1.5
export const BARRIER_HEIGHT = 1.1
export const CONE_HEIGHT = 0.75

export const WHEEL_POSITIONS = {
  FL: [-TRACK_GAUGE / 2, -0.17, WHEELBASE / 2] as const,
  FR: [TRACK_GAUGE / 2, -0.17, WHEELBASE / 2] as const,
  RL: [-TRACK_GAUGE / 2, -0.17, -WHEELBASE / 2] as const,
  RR: [TRACK_GAUGE / 2, -0.17, -WHEELBASE / 2] as const,
}

export const ROAD_HALF_WIDTH = TRACK_WIDTH / 2

export const SUSPENSION = {
  UPPER_CHASSIS_Y: 0.08,
  LOWER_CHASSIS_Y: -0.08,
  UPPER_UPRIGHT_Y: 0.10,
  LOWER_UPRIGHT_Y: -0.12,

  UPPER_CHASSIS_INBOARD_X: 0.30,
  LOWER_CHASSIS_INBOARD_X: 0.25,

  WISHBONE_TUBE_RADIUS: 0.012,
  WISHBONE_SPREAD: 0.18,

  PUSHROD_RADIUS: 0.008,
  PUSHROD_LOWER_Y_OFFSET: -0.04,
  PUSHROD_UPPER_Y: 0.18,
  PUSHROD_UPPER_INBOARD_X: 0.20,

  ROCKER_LENGTH: 0.08,
  ROCKER_RADIUS: 0.010,

  SPRING_RADIUS: 0.025,
  SPRING_COILS: 6,
  SPRING_REST_LENGTH: 0.14,
  DAMPER_RADIUS: 0.018,
  DAMPER_BODY_LENGTH: 0.10,
  DAMPER_SHAFT_LENGTH: 0.06,

  UPRIGHT_WIDTH: 0.06,
  UPRIGHT_DEPTH: 0.08,
} as const

// Collision groups (bitmask)
export const GROUP_CAR = 0x0001
export const GROUP_TRACK = 0x0002
export const GROUP_GROUND = 0x0004
export const GROUP_OBJECT = 0x0008
export const GROUP_RAY = 0x0010

// Collision group interaction masks
// interactionGroups(membership, filter)
//
// Car does NOT contact-collide with TRACK or GROUND.
// Raycast suspension is the sole vertical support.
// A ground clamp in the suspension prevents fall-through.
export const CAR_COLLISION_GROUPS = interactionGroups(GROUP_CAR, GROUP_OBJECT)
export const TRACK_COLLISION_GROUPS = interactionGroups(GROUP_TRACK, GROUP_RAY)
export const GROUND_COLLISION_GROUPS = interactionGroups(GROUP_GROUND, GROUP_OBJECT | GROUP_RAY)
export const OBJECT_COLLISION_GROUPS = interactionGroups(GROUP_OBJECT, GROUP_CAR | GROUP_GROUND)
export const SUSPENSION_RAY_GROUPS = interactionGroups(GROUP_RAY, GROUP_TRACK | GROUP_GROUND)

function interactionGroups(membership: number, filter: number): number {
  return (membership << 16) | filter
}
