import { describe, expect, test, beforeEach } from 'bun:test'
import { useGridStore } from './useGridStore'
import type { GridCarState } from '@/types/grid'

function makeCar(id: string, lap: number, dist: number): GridCarState {
  return {
    id,
    kind: id === 'player' ? 'player' : 'ai',
    teamId: 'test',
    driverName: id,
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    speedMs: 0,
    currentLap: lap,
    currentSector: 1,
    distanceAlongLap: dist,
    tireCompound: 'medium',
    tireWearFront: 0,
    tireWearRear: 0,
    inPitLane: false,
    racePosition: 0,
    gapToLeaderMs: null,
    intervalToAheadMs: null,
    dnf: false,
  }
}

describe('useGridStore', () => {
  beforeEach(() => {
    useGridStore.getState().clearAll()
  })

  test('register + classify orders by lap then distance', () => {
    useGridStore.getState().registerCar(makeCar('ai1', 1, 100))
    useGridStore.getState().registerCar(makeCar('player', 2, 50))
    useGridStore.getState().registerCar(makeCar('ai2', 1, 250))

    const cls = useGridStore.getState().classification
    expect(cls[0]).toBe('player')
    expect(cls[1]).toBe('ai2')
    expect(cls[2]).toBe('ai1')
  })

  test('updateCarState bumps version and resorts', () => {
    useGridStore.getState().registerCar(makeCar('a', 1, 0))
    useGridStore.getState().registerCar(makeCar('b', 1, 0))
    const v1 = useGridStore.getState().version

    useGridStore.getState().updateCarState('b', { distanceAlongLap: 500 })
    const v2 = useGridStore.getState().version
    expect(v2).toBeGreaterThan(v1)
    expect(useGridStore.getState().classification[0]).toBe('b')
  })

  test('removeCar drops from classification', () => {
    useGridStore.getState().registerCar(makeCar('a', 1, 0))
    useGridStore.getState().registerCar(makeCar('b', 1, 0))
    useGridStore.getState().removeCar('a')
    expect(useGridStore.getState().classification).toEqual(['b'])
  })
})
