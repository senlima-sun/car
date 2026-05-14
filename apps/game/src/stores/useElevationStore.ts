import { create } from 'zustand'

interface ElevationState {
  targetElevation: number
  onRoad: boolean
  slopeAngle: number
  bankAngle: number
  setTargetElevation: (elevation: number, slope: number, bank: number) => void
  clearElevation: () => void
  roadCount: number
  enterRoad: (elevation: number, slope: number, bank: number) => void
  exitRoad: () => void
}

export const useElevationStore = create<ElevationState>(set => ({
  targetElevation: 0,
  onRoad: false,
  slopeAngle: 0,
  bankAngle: 0,
  roadCount: 0,
  setTargetElevation: (elevation, slope, bank) =>
    set({ targetElevation: elevation, slopeAngle: slope, bankAngle: bank, onRoad: true }),
  clearElevation: () =>
    set({ targetElevation: 0, onRoad: false, slopeAngle: 0, bankAngle: 0, roadCount: 0 }),
  enterRoad: (elevation, slope, bank) =>
    set(s => ({
      roadCount: s.roadCount + 1,
      targetElevation: elevation,
      slopeAngle: slope,
      bankAngle: bank,
      onRoad: true,
    })),
  exitRoad: () =>
    set(s => {
      const count = Math.max(0, s.roadCount - 1)
      return { roadCount: count, onRoad: count > 0 }
    }),
}))
