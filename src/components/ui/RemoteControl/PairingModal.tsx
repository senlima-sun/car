import { useState, useEffect, useRef } from 'react'
import { useRemoteControlStore } from '../../../stores/useRemoteControlStore'
import { ConnectionManager } from '../../../utils/webrtc/ConnectionManager'
import { decodeControllerState, isControllerPacket, isControlMessage, decodeControlMessage, encodeControlMessage } from '../../../utils/webrtc/protocol'

interface PairingModalProps {
  onClose: () => void
}

export function PairingModal({ onClose }: PairingModalProps) {
  const { connectionStatus, roomId, generateRoomId, setConnectionStatus, updateControllerState, setLatency, reset } = useRemoteControlStore()
  const connectionRef = useRef<ConnectionManager | null>(null)
  const [controllerUrl, setControllerUrl] = useState('')

  useEffect(() => {
    const id = generateRoomId()
    const signalingHost = window.location.hostname
    const signalingPort = 3001
    const signalingUrl = `ws://${signalingHost}:${signalingPort}/ws`
    const gameHost = window.location.host
    const url = `${window.location.protocol}//${gameHost}/controller?room=${id}&signal=${encodeURIComponent(signalingUrl)}`
    setControllerUrl(url)

    const manager = new ConnectionManager(signalingUrl, id, true, {
      onStatusChange: (status) => {
        setConnectionStatus(status)
        if (status === 'connected') {
          setTimeout(onClose, 500)
        }
      },
      onData: (data) => {
        if (isControllerPacket(data)) {
          const { state } = decodeControllerState(data)
          updateControllerState(state)
        } else if (isControlMessage(data)) {
          const msg = decodeControlMessage(data)
          if (msg.type === 'ping') {
            manager.send(encodeControlMessage({ type: 'pong', timestamp: msg.timestamp }))
          } else if (msg.type === 'pong') {
            const latency = Math.round((performance.now() - msg.timestamp) / 2)
            setLatency(latency)
          }
        }
      },
    })

    connectionRef.current = manager
    manager.connect()

    return () => {
      manager.disconnect()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-lg font-medium">Connect Phone Controller</h2>
          <button
            onClick={() => {
              connectionRef.current?.disconnect()
              reset()
              onClose()
            }}
            className="text-neutral-400 hover:text-white text-xl leading-none"
          >
            x
          </button>
        </div>

        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-block bg-neutral-800 rounded-lg px-4 py-3 mb-3">
              <span className="text-neutral-400 text-sm">Room Code</span>
              <div className="text-white text-3xl font-mono tracking-widest mt-1">{roomId.toUpperCase()}</div>
            </div>
          </div>

          <div className="bg-neutral-800 rounded p-3">
            <p className="text-neutral-400 text-xs mb-2">Open this URL on your phone:</p>
            <p className="text-blue-400 text-sm break-all font-mono select-all">{controllerUrl}</p>
          </div>

          <div className="flex items-center gap-2 justify-center">
            {connectionStatus === 'disconnected' && (
              <span className="text-neutral-500 text-sm">Waiting for connection...</span>
            )}
            {connectionStatus === 'connecting' && (
              <>
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-yellow-400 text-sm">Connecting...</span>
              </>
            )}
            {connectionStatus === 'connected' && (
              <>
                <span className="w-2 h-2 bg-green-400 rounded-full" />
                <span className="text-green-400 text-sm">Connected!</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
