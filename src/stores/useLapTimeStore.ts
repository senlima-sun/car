import { create } from 'zustand'

const CROSSING_COOLDOWN_MS = 2000
const WRONG_WAY_DISMISS_MS = 3000
const MAX_LAP_SAMPLES = 3000
const SAMPLE_INTERVAL_MS = 200

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

  currentLapPositions: Float32Array
  currentLapSpeeds: Float32Array
  positionHead: number
  lastSampleTime: number
  bestLapPath: { positions: Float32Array; speeds: Float32Array; count: number } | null
  racingLineVisible: boolean

  setActive: (active: boolean, sectorCheckpoints?: number) => void
  toggleRecording: () => void
  crossStartFinish: (isWrongWay?: boolean) => void
  crossSector: (checkpointOrder: number, isWrongWay?: boolean) => void
  updateCurrentTime: () => void
  setWrongWay: (wrongWay: boolean) => void
  recordPosition: (x: number, y: number, z: number, speed: number) => void
  toggleRacingLine: () => void
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

  currentLapPositions: new Float32Array(MAX_LAP_SAMPLES * 3),
  currentLapSpeeds: new Float32Array(MAX_LAP_SAMPLES),
  positionHead: 0,
  lastSampleTime: 0,
  bestLapPath: null,
  racingLineVisible: false,

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
        positionHead: 0,
        lastSampleTime: 0,
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
      const isNewBest = state.bestLapTime === null || lapTime < state.bestLapTime
      const newBest = isNewBest ? lapTime : state.bestLapTime

      let bestLapPath = state.bestLapPath
      if (isNewBest && state.positionHead > 0) {
        const count = state.positionHead
        bestLapPath = {
          positions: new Float32Array(state.currentLapPositions.buffer.slice(0, count * 3 * 4)),
          speeds: new Float32Array(state.currentLapSpeeds.buffer.slice(0, count * 4)),
          count,
        }
      }

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
        positionHead: 0,
        lastSampleTime: 0,
        bestLapPath,
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
        positionHead: 0,
        lastSampleTime: 0,
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

  recordPosition: (x, y, z, speed) => {
    const state = get()
    if (!state.isRecording || state.currentLapStart === null) return

    const now = performance.now()
    if (now - state.lastSampleTime < SAMPLE_INTERVAL_MS) return
    if (state.positionHead >= MAX_LAP_SAMPLES) return

    const head = state.positionHead
    state.currentLapPositions[head * 3] = x
    state.currentLapPositions[head * 3 + 1] = y
    state.currentLapPositions[head * 3 + 2] = z
    state.currentLapSpeeds[head] = speed

    set({ positionHead: head + 1, lastSampleTime: now })
  },

  toggleRacingLine: () => {
    set({ racingLineVisible: !get().racingLineVisible })
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
      positionHead: 0,
      lastSampleTime: 0,
      bestLapPath: null,
      racingLineVisible: false,
    }),
}))
