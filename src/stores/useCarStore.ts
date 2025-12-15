import { create } from 'zustand'

interface CarState {
  speed: number
  gear: number
  rpm: number
  position: [number, number, number]
  rotation: [number, number, number, number]
  steerAngle: number
  wheelRotations: [number, number, number, number]

  updateTelemetry: (data: Partial<Omit<CarState, 'updateTelemetry' | 'reset'>>) => void
  reset: () => void
}

const initialState = {
  speed: 0,
  gear: 1,
  rpm: 0,
  position: [0, 0, 0] as [number, number, number],
  rotation: [0, 0, 0, 1] as [number, number, number, number],
  steerAngle: 0,
  wheelRotations: [0, 0, 0, 0] as [number, number, number, number],
}

export const useCarStore = create<CarState>(set => ({
  ...initialState,

  updateTelemetry: data => set(state => ({ ...state, ...data })),
  reset: () => set(initialState),
}))

// Helper to calculate gear from speed (sequential racing gearbox)
// Tuned car with max speed ~310 km/h
// Short ratios for quick acceleration, close gear spacing
export function calculateGear(speedKmh: number): number {
  if (speedKmh < 0) return -1 // Reverse
  if (speedKmh < 45) return 1 // 0-45 km/h - Launch gear
  if (speedKmh < 85) return 2 // 45-85 km/h
  if (speedKmh < 125) return 3 // 85-125 km/h
  if (speedKmh < 170) return 4 // 125-170 km/h
  if (speedKmh < 220) return 5 // 170-220 km/h
  if (speedKmh < 275) return 6 // 220-275 km/h
  return 7 // 275+ km/h (top gear - overdrive)
}
