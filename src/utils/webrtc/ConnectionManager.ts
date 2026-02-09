import type { SignalingMessage, ConnectionStatus } from './types'

interface ConnectionCallbacks {
  onStatusChange: (status: ConnectionStatus) => void
  onData: (data: ArrayBuffer) => void
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

const LOG = (role: string, ...args: unknown[]) => {
  if (typeof window !== 'undefined' && (window as any).__WEBRTC_DEBUG) {
    console.log(`[WebRTC:${role}]`, ...args)
  }
}

export class ConnectionManager {
  private ws: WebSocket | null = null
  private pc: RTCPeerConnection | null = null
  private dc: RTCDataChannel | null = null
  private roomId: string
  private signalingUrl: string
  private callbacks: ConnectionCallbacks
  private isHost: boolean
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private _status: ConnectionStatus = 'disconnected'
  private destroyed = false
  private role: string

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
    this.role = isHost ? 'host' : 'ctrl'
  }

  get status(): ConnectionStatus {
    return this._status
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status
    LOG(this.role, 'status →', status)
    this.callbacks.onStatusChange(status)
  }

  connect() {
    if (this.destroyed) return
    this.setStatus('connecting')
    this.connectSignaling()
  }

  private connectSignaling() {
    try {
      this.ws = new WebSocket(this.signalingUrl)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      LOG(this.role, 'ws open, joining room', this.roomId)
      this.ws!.send(JSON.stringify({ type: 'join', roomId: this.roomId }))
    }

    this.ws.onmessage = (event) => {
      try {
        const msg: SignalingMessage = JSON.parse(event.data)
        LOG(this.role, 'ws msg:', msg.type)
        this.handleSignalingMessage(msg)
      } catch {}
    }

    this.ws.onclose = () => {
      LOG(this.role, 'ws closed')
      if (!this.destroyed) {
        this.closePeerConnection()
        this.setStatus('disconnected')
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      LOG(this.role, 'ws error')
    }
  }

  private closePeerConnection() {
    if (this.dc) {
      try { this.dc.close() } catch {}
      this.dc = null
    }
    if (this.pc) {
      this.pc.onicecandidate = null
      this.pc.onconnectionstatechange = null
      this.pc.ondatachannel = null
      try { this.pc.close() } catch {}
      this.pc = null
    }
  }

  private createPeerConnection() {
    this.closePeerConnection()

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
      const state = this.pc?.connectionState
      LOG(this.role, 'pc state →', state)
      if (state === 'connected') {
        this.setStatus('connected')
        this.reconnectAttempts = 0
      } else if (state === 'failed') {
        LOG(this.role, 'pc failed, requesting renegotiation')
        this.closePeerConnection()
        if (this.isHost) {
          this.sendSignaling({ type: 'offer', payload: null, roomId: this.roomId })
        }
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
    dc.onopen = () => LOG(this.role, 'dc open')
    dc.onclose = () => LOG(this.role, 'dc closed')
    dc.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.callbacks.onData(event.data)
      }
    }
  }

  private async createOffer() {
    if (!this.pc) return
    try {
      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)
      this.sendSignaling({
        type: 'offer',
        payload: this.pc.localDescription!.toJSON(),
        roomId: this.roomId,
      })
    } catch (e) {
      LOG(this.role, 'createOffer failed:', e)
    }
  }

  private async handleSignalingMessage(msg: SignalingMessage) {
    try {
      if (msg.type === 'peer-joined' && this.isHost) {
        this.createPeerConnection()
        await this.createOffer()
      } else if (msg.type === 'offer' && !this.isHost) {
        if (!msg.payload) return
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
        if (this.pc?.signalingState === 'have-local-offer') {
          await this.pc.setRemoteDescription(new RTCSessionDescription(msg.payload as RTCSessionDescriptionInit))
        }
      } else if (msg.type === 'ice-candidate') {
        if (this.pc && this.pc.remoteDescription) {
          await this.pc.addIceCandidate(new RTCIceCandidate(msg.payload as RTCIceCandidateInit))
        }
      } else if (msg.type === 'leave') {
        this.closePeerConnection()
        if (this._status === 'connected') {
          this.setStatus('connecting')
        }
      }
    } catch (e) {
      LOG(this.role, 'signaling handler error:', e)
    }
  }

  private sendSignaling(msg: SignalingMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 8000)
    this.reconnectAttempts++
    LOG(this.role, `reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  send(data: ArrayBuffer) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(data)
    }
  }

  disconnect() {
    this.destroyed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.closePeerConnection()
    if (this.ws) {
      this.ws.onclose = null
      this.ws.onerror = null
      try { this.ws.close() } catch {}
      this.ws = null
    }
    this.setStatus('disconnected')
  }
}
