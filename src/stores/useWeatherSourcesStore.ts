import { create } from 'zustand'
import type { WeatherSource } from '@/wasm'

interface WeatherSourcesStore {
  sources: WeatherSource[]
  setSources: (sources: WeatherSource[]) => void
  clear: () => void
}

export const useWeatherSourcesStore = create<WeatherSourcesStore>(set => ({
  sources: [],
  setSources: sources => set({ sources }),
  clear: () => set({ sources: [] }),
}))
