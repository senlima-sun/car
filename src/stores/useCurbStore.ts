import { create } from 'zustand'
import { CURB_PHYSICS, CURB_TURN_MODIFIERS } from '../constants/curb'

export interface CurbModifiers {
  speedMultiplier: number
  gripMultiplier: number
  lateralStability: number
  dragMultiplier: number
}

interface CurbState {
  // Is car currently on any curb
  isOnCurb: boolean

  // Which side of the track (for in/out turn determination)
  curbSide: 'left' | 'right' | null

  // Number of curbs currently in contact (for overlapping curbs)
  contactCount: number

  // Current physics modifiers (computed from state)
  currentModifiers: CurbModifiers

  // Actions
  enterCurb: (side: 'left' | 'right') => void
  exitCurb: () => void
  reset: () => void
}

const DEFAULT_MODIFIERS: CurbModifiers = {
  speedMultiplier: 1.0,
  gripMultiplier: 1.0,
  lateralStability: 1.0,
  dragMultiplier: 1.0,
}

const ON_CURB_MODIFIERS: CurbModifiers = {
  speedMultiplier: CURB_PHYSICS.speedMultiplier,
  gripMultiplier: CURB_PHYSICS.gripMultiplier,
  lateralStability: CURB_PHYSICS.lateralStability,
  dragMultiplier: CURB_PHYSICS.dragMultiplier,
}

export const useCurbStore = create<CurbState>((set, get) => ({
  isOnCurb: false,
  curbSide: null,
  contactCount: 0,
  currentModifiers: DEFAULT_MODIFIERS,

  enterCurb: side => {
    const state = get()
    const newContactCount = state.contactCount + 1

    set({
      isOnCurb: true,
      curbSide: side,
      contactCount: newContactCount,
      currentModifiers: ON_CURB_MODIFIERS,
    })
  },

  exitCurb: () => {
    const state = get()
    const newContactCount = Math.max(0, state.contactCount - 1)

    if (newContactCount === 0) {
      // No longer on any curb
      set({
        isOnCurb: false,
        curbSide: null,
        contactCount: 0,
        currentModifiers: DEFAULT_MODIFIERS,
      })
    } else {
      // Still on another curb
      set({
        contactCount: newContactCount,
      })
    }
  },

  reset: () => {
    set({
      isOnCurb: false,
      curbSide: null,
      contactCount: 0,
      currentModifiers: DEFAULT_MODIFIERS,
    })
  },
}))

// Selector for getting turn-specific modifiers based on steering direction
export function getCurbTurnModifiers(
  curbSide: 'left' | 'right' | null,
  steeringDirection: number,
): CurbModifiers {
  if (!curbSide) return DEFAULT_MODIFIERS

  // Determine if this is an entry or exit curb based on steering
  // Turning left (negative steering) + left curb = exit curb (inside of turn)
  // Turning left + right curb = entry curb (outside of turn)
  // Turning right (positive steering) + right curb = exit curb
  // Turning right + left curb = entry curb

  const isExitCurb =
    (steeringDirection < -0.1 && curbSide === 'left') ||
    (steeringDirection > 0.1 && curbSide === 'right')

  if (isExitCurb) {
    return {
      speedMultiplier: CURB_PHYSICS.speedMultiplier,
      gripMultiplier: CURB_TURN_MODIFIERS.exit.gripMultiplier,
      lateralStability: CURB_TURN_MODIFIERS.exit.lateralStability,
      dragMultiplier: CURB_PHYSICS.dragMultiplier,
    }
  } else {
    return {
      speedMultiplier: CURB_PHYSICS.speedMultiplier,
      gripMultiplier: CURB_TURN_MODIFIERS.entry.gripMultiplier,
      lateralStability: CURB_TURN_MODIFIERS.entry.lateralStability,
      dragMultiplier: CURB_PHYSICS.dragMultiplier,
    }
  }
}
