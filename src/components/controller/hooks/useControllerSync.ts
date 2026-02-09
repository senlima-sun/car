import { useEffect, useRef } from 'react'
import { ConnectionManager } from '../../../utils/webrtc/ConnectionManager'
import { encodeControllerState, encodeControlMessage, decodeControlMessage, isControlMessage } from '../../../utils/webrtc/protocol'
import type { ControllerState } from '../../../utils/webrtc/types'

interface SyncOptions {
  signalingUrl: string
  roomId: string
  getState: () => ControllerState
  onConnected?: () => void
  onDisconnected?: () => void
  onLatency?: (ms: number) => void
}

export function useControllerSync(options: SyncOptions) {
  const connectionRef = useRef<ConnectionManager | null>(null)
  const seqRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const connectedRef = useRef(false)

  useEffect(() => {
    const manager = new ConnectionManager(options.signalingUrl, options.roomId, false, {
      onStatusChange: (status) => {
        connectedRef.current = status === 'connected'
        if (status === 'connected') options.onConnected?.()
        if (status === 'disconnected') options.onDisconnected?.()
      },
      onData: (data) => {
        if (isControlMessage(data)) {
          const msg = decodeControlMessage(data)
          if (msg.type === 'ping') {
            manager.send(encodeControlMessage({ type: 'pong', timestamp: msg.timestamp }))
          } else if (msg.type === 'pong') {
            const latency = Math.round((performance.now() - msg.timestamp) / 2)
            options.onLatency?.(latency)
          }
        }
      },
    })

    connectionRef.current = manager
    manager.connect()

    const sendLoop = () => {
      if (connectedRef.current) {
        const state = options.getState()
        const buffer = encodeControllerState(state, seqRef.current++, performance.now())
        manager.send(buffer)
      }
      rafRef.current = requestAnimationFrame(sendLoop)
    }
    rafRef.current = requestAnimationFrame(sendLoop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      manager.disconnect()
    }
  }, [options.signalingUrl, options.roomId])

  return connectionRef
}
