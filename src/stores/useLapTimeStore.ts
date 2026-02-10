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
  lastStartFinishCrossingTime: number

  wrongWay: boolean
  currentLapInvalid: boolean

  totalSectors: number
  currentSector: number
  sectorStartTime: number | null
  sectorTimes: Map<number, number>
  bestSectorTimes: Map<number, number>
  lastSectorSplit: SectorSplit | null
  lastSectorCrossingTimes: Map<number, number>

  setActive: (active: boolean, sectorCheckpoints?: number) => void
  toggleRecording: () => void
  crossStartFinish: (isWrongWay?: boolean) => void
  crossSector: (checkpointOrder: number, isWrongWay?: boolean) => void
  updateCurrentTime: () => void
  setWrongWay: (wrongWay: boolean) => void
  reset: () => void
}

export const useLapTimeStore = create<LapTimeState>((set, get) => ({
  isActive: false,
  isRecording: false,
  currentLapStart: null,
  currentLapTime: 0,
  lastLapTime: null,
  bestLapTime: null,
  lapCount: 0,
  lastStartFinishCrossingTime: 0,
  wrongWay: false,
  currentLapInvalid: false,
  totalSectors: 0,
  currentSector: 0,
  sectorStartTime: null,
  sectorTimes: new Map(),
  bestSectorTimes: new Map(),
  lastSectorSplit: null,
  lastSectorCrossingTimes: new Map(),

  setActive: (active, sectorCheckpoints = 0) => {
    if (!active) {
      set({
        isActive: false,
        isRecording: false,
        currentLapStart: null,
        currentLapTime: 0,
        lastLapTime: null,
        bestLapTime: null,
        lapCount: 0,
        lastStartFinishCrossingTime: 0,
        wrongWay: false,
        currentLapInvalid: false,
        totalSectors: 0,
        currentSector: 0,
        sectorStartTime: null,
        sectorTimes: new Map(),
        bestSectorTimes: new Map(),
        lastSectorSplit: null,
        lastSectorCrossingTimes: new Map(),
      })
    } else {
      const totalSectors = sectorCheckpoints > 0 ? sectorCheckpoints + 1 : 0
      set({ isActive: true, totalSectors })
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
        lastStartFinishCrossingTime: 0,
        wrongWay: false,
        currentLapInvalid: false,
        currentSector: 0,
        sectorStartTime: null,
        sectorTimes: new Map(),
        bestSectorTimes: new Map(),
        lastSectorSplit: null,
        lastSectorCrossingTimes: new Map(),
        totalSectors: state.totalSectors,
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
    if (now - state.lastStartFinishCrossingTime < CROSSING_COOLDOWN_MS) return

    const sectorReset = {
      currentSector: 0,
      sectorStartTime: now,
      sectorTimes: new Map<number, number>(),
      lastSectorCrossingTimes: new Map<number, number>(),
    }

    if (state.currentLapStart === null) {
      set({
        currentLapStart: now,
        currentLapTime: 0,
        lastStartFinishCrossingTime: now,
        currentLapInvalid: false,
        ...sectorReset,
      })
      return
    }

    const lapTime = now - state.currentLapStart

    let lastSplit: SectorSplit | null = null
    const newBestSectors = new Map(state.bestSectorTimes)

    if (state.totalSectors > 0 && state.sectorStartTime !== null) {
      const finalSectorNum = state.totalSectors
      const finalSectorTime = now - state.sectorStartTime
      const prevBest = newBestSectors.get(finalSectorNum)
      if (!prevBest || finalSectorTime < prevBest) {
        newBestSectors.set(finalSectorNum, finalSectorTime)
      }
      const delta = prevBest ? finalSectorTime - prevBest : null
      lastSplit = { sectorNumber: finalSectorNum, time: finalSectorTime, delta }
    }

    if (!state.currentLapInvalid) {
      const newBest =
        state.bestLapTime === null || lapTime < state.bestLapTime ? lapTime : state.bestLapTime
      set({
        currentLapStart: now,
        currentLapTime: 0,
        lastStartFinishCrossingTime: now,
        currentLapInvalid: false,
        lastLapTime: lapTime,
        bestLapTime: newBest,
        lapCount: state.lapCount + 1,
        bestSectorTimes: newBestSectors,
        lastSectorSplit: lastSplit,
        ...sectorReset,
      })
    } else {
      set({
        currentLapStart: now,
        currentLapTime: 0,
        lastStartFinishCrossingTime: now,
        currentLapInvalid: false,
        lastLapTime: null,
        lapCount: state.lapCount + 1,
        bestSectorTimes: newBestSectors,
        lastSectorSplit: null,
        ...sectorReset,
      })
    }
  },

  crossSector: (checkpointOrder, isWrongWay = false) => {
    const state = get()
    if (!state.isActive || !state.isRecording || state.currentLapStart === null) return
    if (state.totalSectors === 0) return

    if (isWrongWay) {
      set({ wrongWay: true, currentLapInvalid: true })
      setTimeout(() => {
        if (get().wrongWay) set({ wrongWay: false })
      }, WRONG_WAY_DISMISS_MS)
      return
    }

    const now = performance.now()
    const lastCrossing = state.lastSectorCrossingTimes.get(checkpointOrder) ?? 0
    if (now - lastCrossing < CROSSING_COOLDOWN_MS) return

    if (state.sectorStartTime === null) return

    const sectorTime = now - state.sectorStartTime

    const newSectorTimes = new Map(state.sectorTimes)
    newSectorTimes.set(checkpointOrder, sectorTime)

    const newBestSectors = new Map(state.bestSectorTimes)
    const prevBest = newBestSectors.get(checkpointOrder)
    if (!prevBest || sectorTime < prevBest) {
      newBestSectors.set(checkpointOrder, sectorTime)
    }

    const delta = prevBest ? sectorTime - prevBest : null

    const newCrossingTimes = new Map(state.lastSectorCrossingTimes)
    newCrossingTimes.set(checkpointOrder, now)

    set({
      currentSector: checkpointOrder,
      sectorStartTime: now,
      sectorTimes: newSectorTimes,
      bestSectorTimes: newBestSectors,
      lastSectorCrossingTimes: newCrossingTimes,
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
      lastStartFinishCrossingTime: 0,
      wrongWay: false,
      currentLapInvalid: false,
      totalSectors: 0,
      currentSector: 0,
      sectorStartTime: null,
      sectorTimes: new Map(),
      bestSectorTimes: new Map(),
      lastSectorSplit: null,
      lastSectorCrossingTimes: new Map(),
    }),
}))
