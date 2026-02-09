import type { ControllerState, ControllerButtons } from './types'

const PACKET_SIZE = 20

export function encodeControllerState(
  state: ControllerState,
  seq: number,
  timestamp: number,
): ArrayBuffer {
  const buffer = new ArrayBuffer(PACKET_SIZE)
  const view = new DataView(buffer)
  view.setFloat32(0, state.steer, true)
  view.setFloat32(4, state.throttle, true)
  view.setFloat32(8, state.brake, true)
  view.setUint8(12, state.handbrake ? 1 : 0)
  const buttons =
    (state.buttons.ers ? 1 : 0) |
    (state.buttons.aero ? 2 : 0) |
    (state.buttons.camera ? 4 : 0)
  view.setUint8(13, buttons)
  view.setUint16(14, seq & 0xffff, true)
  view.setUint32(16, timestamp >>> 0, true)
  return buffer
}

export function decodeControllerState(buffer: ArrayBuffer): {
  state: ControllerState
  seq: number
  timestamp: number
} {
  const view = new DataView(buffer)
  const buttonsByte = view.getUint8(13)
  return {
    state: {
      steer: view.getFloat32(0, true),
      throttle: view.getFloat32(4, true),
      brake: view.getFloat32(8, true),
      handbrake: view.getUint8(12) === 1,
      buttons: {
        ers: (buttonsByte & 1) !== 0,
        aero: (buttonsByte & 2) !== 0,
        camera: (buttonsByte & 4) !== 0,
      },
    },
    seq: view.getUint16(14, true),
    timestamp: view.getUint32(16, true),
  }
}

export function encodeControlMessage(msg: { type: 'ping' | 'pong'; timestamp: number }): ArrayBuffer {
  const buffer = new ArrayBuffer(5)
  const view = new DataView(buffer)
  view.setUint8(0, msg.type === 'ping' ? 1 : 2)
  view.setUint32(1, msg.timestamp >>> 0, true)
  return buffer
}

export function decodeControlMessage(buffer: ArrayBuffer): { type: 'ping' | 'pong'; timestamp: number } {
  const view = new DataView(buffer)
  const typeByte = view.getUint8(0)
  return {
    type: typeByte === 1 ? 'ping' : 'pong',
    timestamp: view.getUint32(1, true),
  }
}

export function isControllerPacket(buffer: ArrayBuffer): boolean {
  return buffer.byteLength === PACKET_SIZE
}

export function isControlMessage(buffer: ArrayBuffer): boolean {
  return buffer.byteLength === 5
}
