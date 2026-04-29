import { create } from 'zustand'
import { type GhostReplayData, loadReplay, saveReplay as dbSaveReplay } from '@/utils/ghostReplayDB'
import { useLapTimeStore } from './useLapTimeStore'
import { useTrackStore } from './useTrackStore'

const MAX_GHOST_SAMPLES = 12000
const GHOST_SAMPLE_INTERVAL_MS = 50

export interface GhostBuffers {
  frameCount: number
  positions: Float32Array
  rotations: Float32Array
  steerAngles: Float32Array
  wheelRotations: Float32Array
  timestamps: Float32Array
}

interface GhostCarState {
  replayData: GhostReplayData | null
  isLoaded: boolean
  ghostPosition: [number, number, number] | null
  ghostTimeDelta: number | null

  ghostPositions: Float32Array
  ghostRotations: Float32Array
  ghostSteerAngles: Float32Array
  ghostWheelRotations: Float32Array
  ghostTimestamps: Float32Array
  ghostHead: number
  ghostLastSampleTime: number

  loadReplayForTrack: (trackId: string) => Promise<void>
  saveReplay: (
    trackId: string,
    lapTime: number,
    data: Omit<GhostReplayData, 'trackId' | 'lapTime'>,
  ) => Promise<void>
  clearReplay: () => void
  setGhostFrameState: (pos: [number, number, number] | null, delta: number | null) => void
  recordGhostFrame: (
    x: number,
    y: number,
    z: number,
    qx: number,
    qy: number,
    qz: number,
    qw: number,
    steer: number,
    wheels: [number, number, number, number],
  ) => void
  getGhostBuffers: () => GhostBuffers
  resetGhostRecording: () => void
}

export const useGhostCarStore = create<GhostCarState>()((set, get) => ({
  replayData: null,
  isLoaded: false,
  ghostPosition: null,
  ghostTimeDelta: null,

  ghostPositions: new Float32Array(MAX_GHOST_SAMPLES * 3),
  ghostRotations: new Float32Array(MAX_GHOST_SAMPLES * 4),
  ghostSteerAngles: new Float32Array(MAX_GHOST_SAMPLES),
  ghostWheelRotations: new Float32Array(MAX_GHOST_SAMPLES * 4),
  ghostTimestamps: new Float32Array(MAX_GHOST_SAMPLES),
  ghostHead: 0,
  ghostLastSampleTime: 0,

  loadReplayForTrack: async (trackId: string) => {
    set({ isLoaded: false, replayData: null })
    try {
      const data = await loadReplay(trackId)
      set({ replayData: data, isLoaded: true })
    } catch {
      set({ isLoaded: true })
    }
  },

  saveReplay: async (trackId, lapTime, data) => {
    const current = get().replayData
    if (current && current.lapTime <= lapTime) return
    set({
      replayData: {
        trackId,
        lapTime,
        ...data,
      },
      isLoaded: true,
    })
    try {
      await dbSaveReplay(trackId, lapTime, data)
    } catch {
      // IndexedDB write failed — ghost data stays in memory only
    }
  },

  clearReplay: () => {
    set({ replayData: null, isLoaded: false, ghostPosition: null, ghostTimeDelta: null })
  },

  setGhostFrameState: (pos, delta) => {
    set({ ghostPosition: pos, ghostTimeDelta: delta })
  },

  recordGhostFrame: (x, y, z, qx, qy, qz, qw, steer, wheels) => {
    const lapState = useLapTimeStore.getState()
    if (!lapState.isRecording || lapState.currentLapStart === null) return

    const state = get()
    const now = performance.now()
    if (now - state.ghostLastSampleTime < GHOST_SAMPLE_INTERVAL_MS) return
    if (state.ghostHead >= MAX_GHOST_SAMPLES) return

    const h = state.ghostHead
    state.ghostPositions[h * 3] = x
    state.ghostPositions[h * 3 + 1] = y
    state.ghostPositions[h * 3 + 2] = z
    state.ghostRotations[h * 4] = qx
    state.ghostRotations[h * 4 + 1] = qy
    state.ghostRotations[h * 4 + 2] = qz
    state.ghostRotations[h * 4 + 3] = qw
    state.ghostSteerAngles[h] = steer
    state.ghostWheelRotations[h * 4] = wheels[0]
    state.ghostWheelRotations[h * 4 + 1] = wheels[1]
    state.ghostWheelRotations[h * 4 + 2] = wheels[2]
    state.ghostWheelRotations[h * 4 + 3] = wheels[3]
    state.ghostTimestamps[h] = now - lapState.currentLapStart

    set({ ghostHead: h + 1, ghostLastSampleTime: now })
  },

  getGhostBuffers: () => {
    const state = get()
    const n = state.ghostHead
    return {
      frameCount: n,
      positions: new Float32Array(state.ghostPositions.buffer.slice(0, n * 3 * 4)),
      rotations: new Float32Array(state.ghostRotations.buffer.slice(0, n * 4 * 4)),
      steerAngles: new Float32Array(state.ghostSteerAngles.buffer.slice(0, n * 4)),
      wheelRotations: new Float32Array(state.ghostWheelRotations.buffer.slice(0, n * 4 * 4)),
      timestamps: new Float32Array(state.ghostTimestamps.buffer.slice(0, n * 4)),
    }
  },

  resetGhostRecording: () => {
    set({ ghostHead: 0, ghostLastSampleTime: 0 })
  },
}))

useLapTimeStore.subscribe((state, prev) => {
  const lapAdvanced = state.lapCount > prev.lapCount
  if (!lapAdvanced) return

  const isNewBest = state.bestLapTime !== prev.bestLapTime && state.lastLapTime !== null

  const ghostStore = useGhostCarStore.getState()
  if (isNewBest && ghostStore.ghostHead > 0) {
    const trackId = useTrackStore.getState().trackLibrary.activeTrackId
    if (trackId && state.lastLapTime !== null) {
      ghostStore.saveReplay(trackId, state.lastLapTime, ghostStore.getGhostBuffers())
    }
  }

  ghostStore.resetGhostRecording()
})
