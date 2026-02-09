const PORT = parseInt(process.env.SIGNALING_PORT || '3001')

interface WsData {
  roomId: string | null
}

const rooms = new Map<string, Set<WebSocket>>()

const server = Bun.serve<WsData>({
  port: PORT,
  fetch(req, server) {
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      const upgraded = server.upgrade(req, { data: { roomId: null } })
      if (!upgraded) {
        return new Response('WebSocket upgrade failed', { status: 400 })
      }
      return undefined
    }
    return new Response('Signaling server running', { status: 200 })
  },
  websocket: {
    open(ws) {
    },
    message(ws, message) {
      try {
        const data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message))

        if (data.type === 'join' && data.roomId) {
          ws.data.roomId = data.roomId
          if (!rooms.has(data.roomId)) {
            rooms.set(data.roomId, new Set())
          }
          const room = rooms.get(data.roomId)!
          for (const peer of room) {
            peer.send(JSON.stringify({ type: 'peer-joined', roomId: data.roomId }))
          }
          room.add(ws as unknown as WebSocket)
          return
        }

        const roomId = ws.data.roomId
        if (!roomId) return

        const room = rooms.get(roomId)
        if (!room) return

        const msgStr = typeof message === 'string' ? message : new TextDecoder().decode(message)
        for (const peer of room) {
          if (peer !== (ws as unknown as WebSocket)) {
            peer.send(msgStr)
          }
        }
      } catch {
      }
    },
    close(ws) {
      const roomId = ws.data.roomId
      if (!roomId) return

      const room = rooms.get(roomId)
      if (!room) return

      room.delete(ws as unknown as WebSocket)

      for (const peer of room) {
        peer.send(JSON.stringify({ type: 'leave', roomId }))
      }

      if (room.size === 0) {
        rooms.delete(roomId)
      }
    },
  },
})

console.log(`Signaling server running on port ${PORT}`)
