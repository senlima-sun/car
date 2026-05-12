import { create } from 'zustand'

export type StartLightsStatus = 'idle' | 'lighting' | 'hold' | 'go'

export type StartLightsTrigger = 'session' | 'manual'

export const START_LIGHTS_COLUMNS = 5
export const START_LIGHTS_LAMPS_PER_COLUMN = 4
export const LIGHT_INTERVAL_MS = 1000
export const HOLD_MIN_MS = 200
export const HOLD_MAX_MS = 3000
export const GO_FLASH_MS = 900

interface StartLightsState {
  status: StartLightsStatus
  litColumns: number
  trigger: StartLightsTrigger | null
  armedAt: number | null
  holdDurationMs: number
  goEnteredAt: number | null

  arm: (trigger: StartLightsTrigger, now?: number) => void
  tick: (now: number) => void
  cancel: () => void
  reset: () => void
  isInputLocked: () => boolean
}

const initialState = {
  status: 'idle' as StartLightsStatus,
  litColumns: 0,
  trigger: null as StartLightsTrigger | null,
  armedAt: null as number | null,
  holdDurationMs: 0,
  goEnteredAt: null as number | null,
}

export const useStartLightsStore = create<StartLightsState>((set, get) => ({
  ...initialState,

  arm: (trigger, now = performance.now()) => {
    const holdDurationMs = HOLD_MIN_MS + Math.random() * (HOLD_MAX_MS - HOLD_MIN_MS)
    set({
      status: 'lighting',
      litColumns: 0,
      trigger,
      armedAt: now,
      holdDurationMs,
      goEnteredAt: null,
    })
  },

  tick: now => {
    const s = get()
    if (s.status === 'idle' || s.armedAt === null) return

    const elapsed = now - s.armedAt

    if (s.status === 'lighting') {
      const nextLit = Math.min(START_LIGHTS_COLUMNS, Math.floor(elapsed / LIGHT_INTERVAL_MS) + 1)
      if (nextLit >= START_LIGHTS_COLUMNS) {
        if (s.litColumns !== START_LIGHTS_COLUMNS) {
          set({ status: 'hold', litColumns: START_LIGHTS_COLUMNS })
        }
        return
      }
      if (nextLit !== s.litColumns) set({ litColumns: nextLit })
      return
    }

    if (s.status === 'hold') {
      const holdElapsed = elapsed - (START_LIGHTS_COLUMNS - 1) * LIGHT_INTERVAL_MS
      if (holdElapsed >= s.holdDurationMs) {
        set({ status: 'go', litColumns: 0, goEnteredAt: now })
      }
      return
    }

    if (s.status === 'go' && s.goEnteredAt !== null) {
      if (now - s.goEnteredAt >= GO_FLASH_MS) {
        set({ ...initialState })
      }
    }
  },

  cancel: () => set({ ...initialState }),
  reset: () => set({ ...initialState }),

  isInputLocked: () => {
    const status = get().status
    return status === 'lighting' || status === 'hold'
  },
}))
