import { create } from 'zustand'

const CROSSING_COOLDOWN_MS = 2000
const WRONG_WAY_DISMISS_MS = 3000

interface SectorSplit {
  sectorNumber: number
  time: number
  delta: number | null
}

interface LapTimeState {
  isActive: boolean
  isRecording: boolean

  currentLapStart: number | null
  currentLapTime: number
  lastLapTime: number | null
  bestLapTime: number | null
  lapCount: number
  lastCrossingTime: number

  wrongWay: boolean
  currentLapInvalid: boolean

  totalCheckpoints: number
  currentSector: number
  expectedNextCheckpoint: number
  sectorStartTime: number | null
  sectorTimes: Map<number, number>
  bestSectorTimes: Map<number, number>
  lastSectorSplit: SectorSplit | null

  setActive: (active: boolean, totalCheckpoints?: number) => void
  toggleRecording: () => void
  crossStartFinish: (isWrongWay?: boolean) => void
  crossSector: (checkpointOrder: number, isWrongWay?: boolean) => void
  updateCurrentTime: () => void
  setWrongWay: (wrongWay: boolean) => void
  reset: () => void
}

const initialSectorState = {
  totalCheckpoints: 0,
  currentSector: 0,
  expectedNextCheckpoint: 1,
  sectorStartTime: null as number | null,
  sectorTimes: new Map<number, number>(),
  bestSectorTimes: new Map<number, number>(),
  lastSectorSplit: null as SectorSplit | null,
}

export const useLapTimeStore = create<LapTimeState>((set, get) => ({
  isActive: false,
  isRecording: false,
  currentLapStart: null,
  currentLapTime: 0,
  lastLapTime: null,
  bestLapTime: null,
  lapCount: 0,
  lastCrossingTime: 0,
  wrongWay: false,
  currentLapInvalid: false,
  ...initialSectorState,

  setActive: (active, totalCheckpoints = 0) => {
    if (!active) {
      set({
        isActive: false,
        isRecording: false,
        currentLapStart: null,
        currentLapTime: 0,
        lastLapTime: null,
        bestLapTime: null,
        lapCount: 0,
        lastCrossingTime: 0,
        wrongWay: false,
        currentLapInvalid: false,
        ...initialSectorState,
      })
    } else {
      set({ isActive: true, totalCheckpoints })
    }
  },

  toggleRecording: () => {
    const state = get()
    if (!state.isActive) return

    if (state.isRecording) {
      set({
        isRecording: false,
        currentLapStart: null,
        currentLapTime: 0,
        lastLapTime: null,
        bestLapTime: null,
        lapCount: 0,
        lastCrossingTime: 0,
        wrongWay: false,
        currentLapInvalid: false,
        ...initialSectorState,
        totalCheckpoints: state.totalCheckpoints,
      })
    } else {
      set({ isRecording: true })
    }
  },

  crossStartFinish: (isWrongWay = false) => {
    const state = get()
    if (!state.isActive || !state.isRecording) return

    if (isWrongWay) {
      set({ wrongWay: true, currentLapInvalid: true })
      setTimeout(() => {
        if (get().wrongWay) set({ wrongWay: false })
      }, WRONG_WAY_DISMISS_MS)
      return
    }

    const now = performance.now()
    if (now - state.lastCrossingTime < CROSSING_COOLDOWN_MS) return

    if (state.currentLapStart === null) {
      set({
        currentLapStart: now,
        currentLapTime: 0,
        lastCrossingTime: now,
        currentLapInvalid: false,
        currentSector: 0,
        expectedNextCheckpoint: 1,
        sectorStartTime: now,
        sectorTimes: new Map(),
      })
    } else {
      const lapTime = now - state.currentLapStart

      if (state.sectorStartTime !== null && state.totalCheckpoints > 0) {
        const lastSectorTime = now - state.sectorStartTime
        const sectorNum = state.totalCheckpoints
        const newSectorTimes = new Map(state.sectorTimes)
        newSectorTimes.set(sectorNum, lastSectorTime)

        const newBestSectors = new Map(state.bestSectorTimes)
        const prevBest = newBestSectors.get(sectorNum)
        if (!prevBest || lastSectorTime < prevBest) {
          newBestSectors.set(sectorNum, lastSectorTime)
        }

        const delta = prevBest ? lastSectorTime - prevBest : null

        if (!state.currentLapInvalid) {
          const newBest =
            state.bestLapTime === null || lapTime < state.bestLapTime ? lapTime : state.bestLapTime
          set({
            lastLapTime: lapTime,
            bestLapTime: newBest,
            lapCount: state.lapCount + 1,
            currentLapStart: now,
            currentLapTime: 0,
            lastCrossingTime: now,
            currentLapInvalid: false,
            currentSector: 0,
            expectedNextCheckpoint: 1,
            sectorStartTime: now,
            sectorTimes: new Map(),
            bestSectorTimes: newBestSectors,
            lastSectorSplit: { sectorNumber: sectorNum, time: lastSectorTime, delta },
          })
        } else {
          set({
            lastLapTime: null,
            lapCount: state.lapCount + 1,
            currentLapStart: now,
            currentLapTime: 0,
            lastCrossingTime: now,
            currentLapInvalid: false,
            currentSector: 0,
            expectedNextCheckpoint: 1,
            sectorStartTime: now,
            sectorTimes: new Map(),
            bestSectorTimes: newBestSectors,
            lastSectorSplit: null,
          })
        }
      } else {
        if (!state.currentLapInvalid) {
          const newBest =
            state.bestLapTime === null || lapTime < state.bestLapTime ? lapTime : state.bestLapTime
          set({
            lastLapTime: lapTime,
            bestLapTime: newBest,
            lapCount: state.lapCount + 1,
            currentLapStart: now,
            currentLapTime: 0,
            lastCrossingTime: now,
            currentLapInvalid: false,
            currentSector: 0,
            expectedNextCheckpoint: 1,
            sectorStartTime: now,
            sectorTimes: new Map(),
          })
        } else {
          set({
            lastLapTime: null,
            lapCount: state.lapCount + 1,
            currentLapStart: now,
            currentLapTime: 0,
            lastCrossingTime: now,
            currentLapInvalid: false,
            currentSector: 0,
            expectedNextCheckpoint: 1,
            sectorStartTime: now,
            sectorTimes: new Map(),
          })
        }
      }
    }
  },

  crossSector: (checkpointOrder, isWrongWay = false) => {
    const state = get()
    if (!state.isActive || !state.isRecording || state.currentLapStart === null) return

    if (isWrongWay) {
      set({ wrongWay: true, currentLapInvalid: true })
      setTimeout(() => {
        if (get().wrongWay) set({ wrongWay: false })
      }, WRONG_WAY_DISMISS_MS)
      return
    }

    if (checkpointOrder !== state.expectedNextCheckpoint) {
      set({ currentLapInvalid: true })
      return
    }

    const now = performance.now()
    if (now - state.lastCrossingTime < CROSSING_COOLDOWN_MS) return

    const sectorTime = state.sectorStartTime !== null ? now - state.sectorStartTime : 0

    const newSectorTimes = new Map(state.sectorTimes)
    newSectorTimes.set(checkpointOrder, sectorTime)

    const newBestSectors = new Map(state.bestSectorTimes)
    const prevBest = newBestSectors.get(checkpointOrder)
    if (!prevBest || sectorTime < prevBest) {
      newBestSectors.set(checkpointOrder, sectorTime)
    }

    const delta = prevBest ? sectorTime - prevBest : null

    set({
      currentSector: checkpointOrder,
      expectedNextCheckpoint: checkpointOrder + 1,
      sectorStartTime: now,
      sectorTimes: newSectorTimes,
      bestSectorTimes: newBestSectors,
      lastCrossingTime: now,
      lastSectorSplit: { sectorNumber: checkpointOrder, time: sectorTime, delta },
    })
  },

  updateCurrentTime: () => {
    const state = get()
    if (!state.isActive || !state.isRecording || state.currentLapStart === null) return

    const now = performance.now()
    set({ currentLapTime: now - state.currentLapStart })
  },

  setWrongWay: (wrongWay) => {
    set({ wrongWay })
    if (wrongWay) {
      set({ currentLapInvalid: true })
      setTimeout(() => {
        if (get().wrongWay) set({ wrongWay: false })
      }, WRONG_WAY_DISMISS_MS)
    }
  },

  reset: () =>
    set({
      isRecording: false,
      currentLapStart: null,
      currentLapTime: 0,
      lastLapTime: null,
      bestLapTime: null,
      lapCount: 0,
      lastCrossingTime: 0,
      wrongWay: false,
      currentLapInvalid: false,
      ...initialSectorState,
    }),
}))
