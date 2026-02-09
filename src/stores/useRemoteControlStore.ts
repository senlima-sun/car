import { create } from 'zustand'
import type { ConnectionStatus, ControllerState } from '../utils/webrtc/types'

interface RemoteControlState {
  connectionStatus: ConnectionStatus
  steer: number
  throttle: number
  brake: number
  handbrake: boolean
  buttons: { ers: boolean; aero: boolean; camera: boolean }
  latency: number
  roomId: string

  setConnectionStatus: (status: ConnectionStatus) => void
  updateControllerState: (state: ControllerState) => void
  setLatency: (ms: number) => void
  generateRoomId: () => string
  reset: () => void
}

const initialState = {
  connectionStatus: 'disconnected' as ConnectionStatus,
  steer: 0,
  throttle: 0,
  brake: 0,
  handbrake: false,
  buttons: { ers: false, aero: false, camera: false },
  latency: 0,
  roomId: '',
}

function randomRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export const useRemoteControlStore = create<RemoteControlState>(set => ({
  ...initialState,

  setConnectionStatus: status => set({ connectionStatus: status }),

  updateControllerState: state =>
    set({
      steer: state.steer,
      throttle: state.throttle,
      brake: state.brake,
      handbrake: state.handbrake,
      buttons: state.buttons,
    }),

  setLatency: ms => set({ latency: ms }),

  generateRoomId: () => {
    const id = randomRoomId()
    set({ roomId: id })
    return id
  },

  reset: () => set(initialState),
}))
