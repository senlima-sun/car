import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface LeaderboardEntry {
  id: string
  trackId: string
  driverName: string
  lapTimeMs: number
  capturedAt: number
  setupId: string | null
  valid: boolean
  source: 'personal' | 'challenge' | 'imported'
}

interface LeaderboardState {
  entries: LeaderboardEntry[]
  addEntry: (entry: Omit<LeaderboardEntry, 'id' | 'capturedAt'>) => void
  clearTrack: (trackId: string) => void
  clearAll: () => void
  topForTrack: (trackId: string, limit?: number) => LeaderboardEntry[]
}

export const useLeaderboardStore = create<LeaderboardState>()(
  persist(
    (set, get) => ({
      entries: [],

      addEntry: entry => {
        const full: LeaderboardEntry = {
          ...entry,
          id: `lb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          capturedAt: Date.now(),
        }
        set({ entries: [...get().entries, full] })
      },

      clearTrack: trackId =>
        set({ entries: get().entries.filter(e => e.trackId !== trackId) }),

      clearAll: () => set({ entries: [] }),

      topForTrack: (trackId, limit = 10) =>
        get()
          .entries.filter(e => e.trackId === trackId && e.valid)
          .sort((a, b) => a.lapTimeMs - b.lapTimeMs)
          .slice(0, limit),
    }),
    { name: 'leaderboard-store' },
  ),
)
