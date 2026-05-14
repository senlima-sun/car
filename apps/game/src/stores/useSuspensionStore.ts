import { create } from 'zustand'

interface SuspensionState {
  groundedCount: number
  anyGrounded: boolean
  setGroundedCount: (groundedCount: number) => void
  reset: () => void
}

export const useSuspensionStore = create<SuspensionState>(set => ({
  groundedCount: 0,
  anyGrounded: false,
  setGroundedCount: groundedCount =>
    set({
      groundedCount,
      anyGrounded: groundedCount > 0,
    }),
  reset: () =>
    set({
      groundedCount: 0,
      anyGrounded: false,
    }),
}))
