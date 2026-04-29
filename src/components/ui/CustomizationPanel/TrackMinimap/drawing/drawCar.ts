import type { MinimapTransforms } from '../helpers'

export function drawCar(
  ctx: CanvasRenderingContext2D,
  carPos: [number, number, number],
  t: MinimapTransforms,
) {
  const { toScreenX, toScreenZ, rotX, rotZ } = t
  const carX = rotX(toScreenX(carPos[0]), toScreenZ(carPos[2]))
  const carZ = rotZ(toScreenX(carPos[0]), toScreenZ(carPos[2]))
  ctx.beginPath()
  ctx.arc(carX, carZ, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#00ff88'
  ctx.shadowColor = '#00ff88'
  ctx.shadowBlur = 8
  ctx.fill()
  ctx.shadowBlur = 0
}

export function drawGhost(
  ctx: CanvasRenderingContext2D,
  ghostPos: [number, number, number],
  t: MinimapTransforms,
) {
  const { toScreenX, toScreenZ, rotX, rotZ } = t
  const gx = rotX(toScreenX(ghostPos[0]), toScreenZ(ghostPos[2]))
  const gz = rotZ(toScreenX(ghostPos[0]), toScreenZ(ghostPos[2]))
  ctx.beginPath()
  ctx.arc(gx, gz, 4, 0, Math.PI * 2)
  ctx.fillStyle = '#00ccff'
  ctx.shadowColor = '#00ccff'
  ctx.shadowBlur = 6
  ctx.fill()
  ctx.shadowBlur = 0
}

export function drawCameraView(
  ctx: CanvasRenderingContext2D,
  camTargetX: number,
  camTargetZ: number,
  camDistance: number,
  t: MinimapTransforms,
) {
  const { toScreenX, toScreenZ, rotX, rotZ, scale, drawSize } = t
  const camRx = rotX(toScreenX(camTargetX), toScreenZ(camTargetZ))
  const camRz = rotZ(toScreenX(camTargetX), toScreenZ(camTargetZ))

  const viewRadius = camDistance * scale * 0.6
  const clampedRadius = Math.max(8, Math.min(viewRadius, drawSize * 0.45))

  ctx.beginPath()
  ctx.arc(camRx, camRz, clampedRadius, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
  ctx.lineWidth = 1.5
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(camRx, camRz, clampedRadius, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(camRx, camRz, 3, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
}
