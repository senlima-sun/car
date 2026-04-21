import { describe, expect, test, beforeEach } from 'bun:test'
import { useChampionshipStore } from './useChampionshipStore'

const drivers = [
  { driverName: 'Player', teamId: 'red' },
  { driverName: 'Rival', teamId: 'blue' },
]

describe('useChampionshipStore', () => {
  beforeEach(() => {
    useChampionshipStore.getState().clear()
  })

  test('startChampionship initializes calendar and standings', () => {
    useChampionshipStore.getState().startChampionship(
      'Test Season',
      2026,
      [
        { trackId: 'silverstone', lapLimit: 3 },
        { trackId: 'monza', lapLimit: 3 },
      ],
      drivers,
    )
    const s = useChampionshipStore.getState().championship
    expect(s?.calendar.length).toBe(2)
    expect(s?.driverStandings.length).toBe(2)
    expect(s?.teamStandings.length).toBe(2)
  })

  test('recordResult awards points', () => {
    useChampionshipStore
      .getState()
      .startChampionship('Test', 2026, [{ trackId: 'silverstone', lapLimit: 3 }], drivers)
    useChampionshipStore.getState().recordResult(0, [
      { driverName: 'Player', teamId: 'red', position: 1 },
      { driverName: 'Rival', teamId: 'blue', position: 2 },
    ])
    const player = useChampionshipStore
      .getState()
      .championship!.driverStandings.find(d => d.driverName === 'Player')!
    const rival = useChampionshipStore
      .getState()
      .championship!.driverStandings.find(d => d.driverName === 'Rival')!
    expect(player.points).toBe(25)
    expect(player.wins).toBe(1)
    expect(rival.points).toBe(18)
  })
})
