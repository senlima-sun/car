// 1 world unit = 1 meter
// Reference: F1 car ~5.7m long, 2.0m wide, 0.95m high

export const CAR_LENGTH = 5.0
export const CAR_WIDTH = 2.0
export const CAR_HEIGHT = 1.0

export const WHEEL_RADIUS = 0.33
export const WHEEL_WIDTH = 0.30
export const WHEELBASE = 3.0
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

// Collision groups (bitmask)
export const GROUP_CAR = 0x0001
export const GROUP_TRACK = 0x0002
export const GROUP_GROUND = 0x0004
export const GROUP_OBJECT = 0x0008
export const GROUP_RAY = 0x0010

// Collision group interaction masks
// interactionGroups(membership, filter)
//
// Car wheel BallColliders contact TRACK, GROUND, and OBJECT.
// Suspension keeps car floating above surfaces during normal driving.
// Contact collision is the safety net for falls, flips, and spawning.
export const CAR_COLLISION_GROUPS = interactionGroups(GROUP_CAR, GROUP_TRACK | GROUP_GROUND | GROUP_OBJECT)
export const TRACK_COLLISION_GROUPS = interactionGroups(GROUP_TRACK, GROUP_CAR | GROUP_RAY)
export const GROUND_COLLISION_GROUPS = interactionGroups(GROUP_GROUND, GROUP_CAR | GROUP_OBJECT | GROUP_RAY)
export const OBJECT_COLLISION_GROUPS = interactionGroups(GROUP_OBJECT, GROUP_CAR | GROUP_GROUND)
export const SUSPENSION_RAY_GROUPS = interactionGroups(GROUP_RAY, GROUP_TRACK | GROUP_GROUND)

function interactionGroups(membership: number, filter: number): number {
  return (membership << 16) | filter
}
