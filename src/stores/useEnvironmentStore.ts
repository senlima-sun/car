import { create } from 'zustand'

interface EnvironmentStore {
  temperature: number // Celsius (-10 to 50)
  humidity: number // 0 to 1
  precipitationRate: number // mm/h (0-50)
  pressure: number // hPa
  cloudCover: number // 0 to 1
  rainIntensity: number // 0 to 1 (derived from precipitationRate, kept for backward compat)

  isModalOpen: boolean

  setTemperature: (temp: number) => void
  setHumidity: (humidity: number) => void
  setPrecipitationRate: (rate: number) => void
  setPressure: (hPa: number) => void
  setCloudCover: (cover: number) => void
  setRainIntensity: (intensity: number) => void
  openModal: () => void
  closeModal: () => void
  toggleModal: () => void
}

export const useEnvironmentStore = create<EnvironmentStore>((set, get) => ({
  temperature: 25,
  humidity: 0.3,
  precipitationRate: 0,
  pressure: 1013.25,
  cloudCover: 0.2,
  rainIntensity: 0,

  isModalOpen: false,

  setTemperature: temp => set({ temperature: Math.max(-10, Math.min(50, temp)) }),

  setHumidity: humidity => set({ humidity: Math.max(0, Math.min(1, humidity)) }),

  setPrecipitationRate: rate => {
    const clamped = Math.max(0, Math.min(50, rate))
    set({
      precipitationRate: clamped,
      rainIntensity: Math.min(clamped / 50, 1),
      cloudCover: clamped > 0.1 ? Math.max(get().cloudCover, 0.6) : get().cloudCover,
    })
  },

  setPressure: hPa => set({ pressure: Math.max(900, Math.min(1100, hPa)) }),

  setCloudCover: cover => set({ cloudCover: Math.max(0, Math.min(1, cover)) }),

  setRainIntensity: intensity => {
    const clamped = Math.max(0, Math.min(1, intensity))
    const rate = clamped * 50
    set({
      rainIntensity: clamped,
      precipitationRate: rate,
      humidity: Math.max(get().humidity, 0.3 + clamped * 0.6),
      cloudCover: clamped > 0.01 ? Math.max(get().cloudCover, 0.6) : get().cloudCover,
    })
  },

  openModal: () => set({ isModalOpen: true }),
  closeModal: () => set({ isModalOpen: false }),
  toggleModal: () => set(state => ({ isModalOpen: !state.isModalOpen })),
}))

export function getRainDescription(intensity: number): string {
  if (intensity < 0.01) return 'None'
  if (intensity < 0.2) return 'Light Drizzle'
  if (intensity < 0.4) return 'Light Rain'
  if (intensity < 0.6) return 'Moderate Rain'
  if (intensity < 0.8) return 'Heavy Rain'
  return 'Downpour'
}

export function getTemperatureDescription(celsius: number): string {
  if (celsius < 0) return 'Freezing'
  if (celsius < 10) return 'Cold'
  if (celsius < 20) return 'Cool'
  if (celsius < 30) return 'Warm'
  if (celsius < 40) return 'Hot'
  return 'Extreme Heat'
}
