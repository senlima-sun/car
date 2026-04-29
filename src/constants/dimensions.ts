// 1 world unit = 1 meter
// Reference: 2026 F1 car ~5.5m long, 1.9m wide, 0.95m high

export const CAR_LENGTH = 5.5
export const CAR_WIDTH = 1.9
export const CAR_HEIGHT = 1.0

export const WHEEL_RADIUS = 0.37
export const WHEEL_WIDTH_FRONT = 0.381
export const WHEEL_WIDTH_REAR = 0.4
export const WHEELBASE = 3.38
export const TRACK_GAUGE_FRONT = 1.52
export const TRACK_GAUGE_REAR = 1.53
export const TRACK_GAUGE = TRACK_GAUGE_FRONT
export const CG_HEIGHT = 0.35

export const TRACK_WIDTH = 12
export const TRACK_EDGE_LINE_WIDTH = 0.2
export const ROAD_THICKNESS = 0.15
export const CURB_WIDTH = 1.5
export const PAINTED_WIDTH = 3
export const BARRIER_HEIGHT = 1.1
export const CONE_HEIGHT = 0.75
export const WALL_HEIGHT = 0.8
export const WALL_WIDTH = 0.5
export const FENCE_HEIGHT = 1.2

export const WHEEL_POSITIONS = {
  FL: [-TRACK_GAUGE_FRONT / 2, 0, WHEELBASE / 2] as const,
  FR: [TRACK_GAUGE_FRONT / 2, 0, WHEELBASE / 2] as const,
  RL: [-TRACK_GAUGE_REAR / 2, 0, -WHEELBASE / 2] as const,
  RR: [TRACK_GAUGE_REAR / 2, 0, -WHEELBASE / 2] as const,
}

export const ROAD_HALF_WIDTH = TRACK_WIDTH / 2

export const SUSPENSION = {
  UPPER_CHASSIS_Y: 0.08,
  LOWER_CHASSIS_Y: -0.08,
  UPPER_UPRIGHT_Y: 0.1,
  LOWER_UPRIGHT_Y: -0.12,

  UPPER_CHASSIS_INBOARD_X: 0.3,
  LOWER_CHASSIS_INBOARD_X: 0.25,

  WISHBONE_TUBE_RADIUS: 0.012,
  WISHBONE_SPREAD: 0.18,

  PUSHROD_RADIUS: 0.008,
  PUSHROD_LOWER_Y_OFFSET: -0.04,
  PUSHROD_UPPER_Y: 0.18,
  PUSHROD_UPPER_INBOARD_X: 0.2,

  ROCKER_LENGTH: 0.08,
  ROCKER_RADIUS: 0.01,

  SPRING_RADIUS: 0.025,
  SPRING_COILS: 6,
  SPRING_REST_LENGTH: 0.14,
  DAMPER_RADIUS: 0.018,
  DAMPER_BODY_LENGTH: 0.1,
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
