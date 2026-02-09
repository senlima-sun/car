export type SignalingMessageType = 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave' | 'peer-joined'

export interface SignalingMessage {
  type: SignalingMessageType
  payload: unknown
  roomId: string
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

export interface ControllerState {
  steer: number
  throttle: number
  brake: number
  handbrake: boolean
  buttons: ControllerButtons
}

export interface ControllerButtons {
  ers: boolean
  aero: boolean
  camera: boolean
}

export interface PingMessage {
  type: 'ping'
  timestamp: number
}

export interface PongMessage {
  type: 'pong'
  timestamp: number
}

export type ControlMessage = PingMessage | PongMessage
