import { create } from 'zustand'

interface EnvironmentStore {
  // Granular environment values
  temperature: number // Celsius (-10 to 50)
  rainIntensity: number // 0 to 1 (0% to 100%)

  // Modal state
  isModalOpen: boolean

  // Actions
  setTemperature: (temp: number) => void
  setRainIntensity: (intensity: number) => void
  openModal: () => void
  closeModal: () => void
  toggleModal: () => void
}

export const useEnvironmentStore = create<EnvironmentStore>((set) => ({
  // Default values (room temperature, no rain)
  temperature: 25,
  rainIntensity: 0,

  // Modal starts closed
  isModalOpen: false,

  setTemperature: (temp) =>
    set({
      temperature: Math.max(-10, Math.min(50, temp)),
    }),

  setRainIntensity: (intensity) =>
    set({
      rainIntensity: Math.max(0, Math.min(1, intensity)),
    }),

  openModal: () => set({ isModalOpen: true }),

  closeModal: () => set({ isModalOpen: false }),

  toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),
}))

// Utility function to get rain description from intensity
export function getRainDescription(intensity: number): string {
  if (intensity < 0.01) return 'None'
  if (intensity < 0.2) return 'Light Drizzle'
  if (intensity < 0.4) return 'Light Rain'
  if (intensity < 0.6) return 'Moderate Rain'
  if (intensity < 0.8) return 'Heavy Rain'
  return 'Downpour'
}

// Utility function to get temperature description
export function getTemperatureDescription(celsius: number): string {
  if (celsius < 0) return 'Freezing'
  if (celsius < 10) return 'Cold'
  if (celsius < 20) return 'Cool'
  if (celsius < 30) return 'Warm'
  if (celsius < 40) return 'Hot'
  return 'Extreme Heat'
}
