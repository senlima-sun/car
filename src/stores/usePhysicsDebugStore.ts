import { create } from 'zustand'

interface WheelDebug {
  compression: number
  hitY: number
  isGrounded: boolean
  rayOriginY: number
}

const DEFAULT_WHEEL: WheelDebug = { compression: 0, hitY: 0, isGrounded: false, rayOriginY: 0 }

interface PhysicsDebugState {
  enabled: boolean
  toggle: () => void

  posY: number
  velY: number
  totalForceY: number
  groundedCount: number
  wheels: [WheelDebug, WheelDebug, WheelDebug, WheelDebug]

  update: (data: {
    posY: number
    velY: number
    totalForceY: number
    groundedCount: number
    wheels: [WheelDebug, WheelDebug, WheelDebug, WheelDebug]
  }) => void
}

export const usePhysicsDebugStore = create<PhysicsDebugState>(set => ({
  enabled: false,
  toggle: () => set(s => ({ enabled: !s.enabled })),

  posY: 0,
  velY: 0,
  totalForceY: 0,
  groundedCount: 0,
  wheels: [DEFAULT_WHEEL, DEFAULT_WHEEL, DEFAULT_WHEEL, DEFAULT_WHEEL],

  update: data => set(data),
}))
