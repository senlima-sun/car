import type { SignalingMessage, ConnectionStatus } from './types'

interface ConnectionCallbacks {
  onStatusChange: (status: ConnectionStatus) => void
  onData: (data: ArrayBuffer) => void
  onLatency?: (ms: number) => void
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

export class ConnectionManager {
  private ws: WebSocket | null = null
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private roomId: string
  private signalingUrl: string
  private callbacks: ConnectionCallbacks
  private isHost: boolean
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _status: ConnectionStatus = 'disconnected'

  constructor(
    signalingUrl: string,
    roomId: string,
    isHost: boolean,
    callbacks: ConnectionCallbacks,
  ) {
    this.signalingUrl = signalingUrl
    this.roomId = roomId
    this.isHost = isHost
    this.callbacks = callbacks
  }

  get status(): ConnectionStatus {
    return this._status
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status
    this.callbacks.onStatusChange(status)
  }

  connect() {
    this.setStatus('connecting')
    this.connectSignaling()
  }

  private connectSignaling() {
    this.ws = new WebSocket(this.signalingUrl)

    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: 'join', roomId: this.roomId }))
    }

    this.ws.onmessage = (event) => {
      try {
        const msg: SignalingMessage = JSON.parse(event.data)
        this.handleSignalingMessage(msg)
      } catch {}
    }

    this.ws.onclose = () => {
      if (this._status !== 'disconnected') {
        this.handleDisconnect()
      }
    }

    this.ws.onerror = () => {
      if (this._status !== 'disconnected') {
        this.handleDisconnect()
      }
    }
  }

  private createPeerConnection() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'ice-candidate',
          payload: event.candidate.toJSON(),
          roomId: this.roomId,
        })
      }
    }

    this.pc.onconnectionstatechange = () => {
      if (this.pc?.connectionState === 'connected') {
        this.setStatus('connected')
        this.reconnectAttempts = 0
      } else if (
        this.pc?.connectionState === 'disconnected' ||
        this.pc?.connectionState === 'failed'
      ) {
        this.handleDisconnect()
      }
    }

    if (this.isHost) {
      this.dc = this.pc.createDataChannel('controller', {
        ordered: false,
        maxRetransmits: 0,
      })
      this.setupDataChannel(this.dc)
    } else {
      this.pc.ondatachannel = (event) => {
        this.dc = event.channel
        this.setupDataChannel(this.dc)
      }
    }
  }

  private setupDataChannel(dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer'
    dc.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.callbacks.onData(event.data)
      }
    }
  }

  private async createOffer() {
    if (!this.pc) return
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    this.sendSignaling({
      type: 'offer',
      payload: this.pc.localDescription!.toJSON(),
      roomId: this.roomId,
    })
  }

  private async handleSignalingMessage(msg: SignalingMessage) {
    if (msg.type === 'peer-joined' && this.isHost) {
      this.pc?.close()
      this.createPeerConnection()
      await this.createOffer()
    } else if (msg.type === 'offer' && !this.isHost) {
      this.createPeerConnection()
      await this.pc!.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit))
      const answer = await this.pc!.createAnswer()
      await this.pc!.setLocalDescription(answer)
      this.sendSignaling({
        type: 'answer',
        payload: this.pc!.localDescription!.toJSON(),
        roomId: this.roomId,
      })
    } else if (msg.type === 'answer' && this.isHost) {
      await this.pc?.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit))
    } else if (msg.type === 'ice-candidate') {
      await this.pc?.addIceCandidate(new RTCIceCandidate(msg.payload as RTCIceCandidateInit))
    } else if (msg.type === 'leave') {
      this.handleDisconnect()
    }
  }

  private sendSignaling(msg: SignalingMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private handleDisconnect() {
    if (this._status === 'disconnected') return
    this.setStatus('disconnected')
    this.cleanup()

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 8000)
      this.reconnectAttempts++
      this.reconnectTimer = setTimeout(() => this.connect(), delay)
    }
  }

  send(data: ArrayBuffer) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(data)
    }
  }

  private cleanup() {
    this.dc?.close()
    this.dc = null
    this.pc?.close()
    this.pc = null
    this.ws?.close()
    this.ws = null
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectAttempts = this.maxReconnectAttempts
    this.cleanup()
    this.setStatus('disconnected')
  }
}
