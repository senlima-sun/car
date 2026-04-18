import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  pointsForPosition,
  type ChampionshipRound,
  type ChampionshipStanding,
  type ChampionshipState,
} from '@/types/championship'

interface ChampionshipStore {
  championship: ChampionshipState | null

  startChampionship: (
    name: string,
    season: number,
    calendar: Array<{ trackId: string; lapLimit: number }>,
    drivers: Array<{ driverName: string; teamId: string }>,
  ) => void
  recordResult: (roundIndex: number, results: Array<{ driverName: string; teamId: string; position: number }>) => void
  advanceRound: () => void
  clear: () => void
}

function buildStandings(drivers: Array<{ driverName: string; teamId: string }>): {
  drivers: ChampionshipStanding[]
  teams: ChampionshipStanding[]
} {
  const driverStandings = drivers.map(d => ({
    driverName: d.driverName,
    teamId: d.teamId,
    points: 0,
    wins: 0,
    podiums: 0,
  }))
  const teamMap = new Map<string, ChampionshipStanding>()
  for (const d of drivers) {
    if (!teamMap.has(d.teamId)) {
      teamMap.set(d.teamId, {
        driverName: '',
        teamId: d.teamId,
        points: 0,
        wins: 0,
        podiums: 0,
      })
    }
  }
  return { drivers: driverStandings, teams: [...teamMap.values()] }
}

export const useChampionshipStore = create<ChampionshipStore>()(
  persist(
    (set, get) => ({
      championship: null,

      startChampionship: (name, season, calendar, drivers) => {
        const { drivers: driverStandings, teams: teamStandings } = buildStandings(drivers)
        const rounds: ChampionshipRound[] = calendar.map(r => ({
          ...r,
          completed: false,
          resultPosition: null,
        }))
        set({
          championship: {
            id: `champ-${season}-${Date.now()}`,
            season,
            name,
            calendar: rounds,
            currentRoundIndex: 0,
            driverStandings,
            teamStandings,
          },
        })
      },

      recordResult: (roundIndex, results) => {
        const state = get().championship
        if (!state) return
        const round = state.calendar[roundIndex]
        if (!round) return

        const driverStandings = state.driverStandings.map(d => {
          const res = results.find(r => r.driverName === d.driverName)
          if (!res) return d
          const pts = pointsForPosition(res.position)
          return {
            ...d,
            points: d.points + pts,
            wins: d.wins + (res.position === 1 ? 1 : 0),
            podiums: d.podiums + (res.position <= 3 ? 1 : 0),
          }
        })
        const teamStandings = state.teamStandings.map(t => {
          const teamResults = results.filter(r => r.teamId === t.teamId)
          const pts = teamResults.reduce((s, r) => s + pointsForPosition(r.position), 0)
          const wins = teamResults.filter(r => r.position === 1).length
          const podiums = teamResults.filter(r => r.position <= 3).length
          return {
            ...t,
            points: t.points + pts,
            wins: t.wins + wins,
            podiums: t.podiums + podiums,
          }
        })
        const calendar = state.calendar.map((r, i) =>
          i === roundIndex
            ? {
                ...r,
                completed: true,
                resultPosition: results[0]?.position ?? null,
              }
            : r,
        )
        set({
          championship: {
            ...state,
            driverStandings,
            teamStandings,
            calendar,
          },
        })
      },

      advanceRound: () => {
        const state = get().championship
        if (!state) return
        set({
          championship: {
            ...state,
            currentRoundIndex: Math.min(
              state.currentRoundIndex + 1,
              state.calendar.length - 1,
            ),
          },
        })
      },

      clear: () => set({ championship: null }),
    }),
    { name: 'championship-store' },
  ),
)
