import { Vector3 } from 'three'

export interface CarState {
  position: Vector3
  velocity: number
  rotation: number
  skidIntensity: number
  isDrifting: boolean
  isBraking: boolean
  speedKmh: number
}
