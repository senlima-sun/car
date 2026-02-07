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
