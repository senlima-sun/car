import { TireCompound } from '@/wasm/PhysicsBridge'
import type { ErsMode, AeroMode } from '@/wasm/PhysicsBridge'

export interface CarSetup {
  /** 0..1, higher = more front downforce */
  frontWing: number
  /** 0..1, higher = more rear downforce */
  rearWing: number
  /** 0..1, front brake bias fraction */
  brakeBias: number
  /** 0..2 engine-braking level (0 = low, 1 = medium, 2 = high) */
  engineBrakeLevel: number
  /** 0..1 front spring stiffness */
  frontSpring: number
  /** 0..1 rear spring stiffness */
  rearSpring: number
  /** 0..1 front damper */
  frontDamper: number
  /** 0..1 rear damper */
  rearDamper: number
  /** mm ride height front */
  rideHeightFrontMm: number
  /** mm ride height rear */
  rideHeightRearMm: number
  /** Starting tire compound */
  tireCompound: TireCompound
  /** Default aero mode */
  aeroMode: AeroMode
  /** Default ERS mode */
  ersMode: ErsMode
}

export const DEFAULT_SETUP: CarSetup = {
  frontWing: 0.5,
  rearWing: 0.5,
  brakeBias: 0.56,
  engineBrakeLevel: 1,
  frontSpring: 0.5,
  rearSpring: 0.5,
  frontDamper: 0.5,
  rearDamper: 0.5,
  rideHeightFrontMm: 30,
  rideHeightRearMm: 50,
  tireCompound: TireCompound.Medium,
  aeroMode: 'Corner',
  ersMode: 'SemiAuto',
}
