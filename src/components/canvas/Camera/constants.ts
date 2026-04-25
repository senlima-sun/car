import { Vector3, Quaternion } from 'three'

export const CAMERA_NEAR = 0.1
export const CAMERA_FAR = 1000
export const CAMERA_FAR_EXTENDED = 2000

export const FLIP_ROTATION = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI)

export const SURFACE_SHAKE_INTENSITY: Record<string, number> = {
  road: 0,
  curb: 0.008,
  pitroad: 0,
  gravel: 0.022,
  grass: 0,
}

export const SURFACE_SHAKE_ROTATION: Record<string, number> = {
  road: 0,
  curb: 0.002,
  pitroad: 0,
  gravel: 0.008,
  grass: 0,
}

export const SURFACE_SHAKE_FREQ: Record<string, number> = {
  road: 0,
  curb: 1.0,
  pitroad: 0,
  gravel: 1.2,
  grass: 0,
}
