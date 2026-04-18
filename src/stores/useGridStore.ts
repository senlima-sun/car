import { create } from 'zustand'
import type { GridCarState } from '@/types/grid'

interface GridStore {
  version: number
  cars: Record<string, GridCarState>
  classification: string[]
  leaderLap: number

  registerCar: (car: GridCarState) => void
  removeCar: (id: string) => void
  updateCarState: (id: string, patch: Partial<GridCarState>) => void
  setClassification: (order: string[]) => void
  setLeaderLap: (lap: number) => void
  clearAll: () => void
}

function computeClassification(cars: Record<string, GridCarState>): string[] {
  return Object.values(cars)
    .sort((a, b) => {
      if (a.currentLap !== b.currentLap) return b.currentLap - a.currentLap
      return b.distanceAlongLap - a.distanceAlongLap
    })
    .map(c => c.id)
}

export const useGridStore = create<GridStore>((set, get) => {
  const commitCars = (cars: Record<string, GridCarState>) => {
    set({
      cars,
      classification: computeClassification(cars),
      version: get().version + 1,
    })
  }

  return {
    version: 0,
    cars: {},
    classification: [],
    leaderLap: 0,

    registerCar: car => commitCars({ ...get().cars, [car.id]: car }),

    removeCar: id => {
      const cars = { ...get().cars }
      delete cars[id]
      commitCars(cars)
    },

    updateCarState: (id, patch) => {
      const current = get().cars[id]
      if (!current) return
      commitCars({ ...get().cars, [id]: { ...current, ...patch } })
    },

    setClassification: order => set({ classification: order, version: get().version + 1 }),
    setLeaderLap: lap => set({ leaderLap: lap }),

    clearAll: () =>
      set({
        cars: {},
        classification: [],
        leaderLap: 0,
        version: get().version + 1,
      }),
  }
})
