import { create } from 'zustand'

interface SteeringDebugState {
  inputSteer: number
  steerAngleDeg: number
  maxSteerAngleDeg: number
  yawRate: number
  speedKmh: number
  slipAngleDeg: number
  lateralG: number
  isDrifting: boolean
  update: (data: Omit<SteeringDebugState, 'update'>) => void
}

export const useSteeringDebugStore = create<SteeringDebugState>(set => ({
  inputSteer: 0,
  steerAngleDeg: 0,
  maxSteerAngleDeg: 0,
  yawRate: 0,
  speedKmh: 0,
  slipAngleDeg: 0,
  lateralG: 0,
  isDrifting: false,
  update: data => set(data),
}))
