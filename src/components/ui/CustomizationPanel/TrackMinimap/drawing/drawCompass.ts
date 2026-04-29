import { MINIMAP_SIZE } from '../constants'

export function drawCompass(ctx: CanvasRenderingContext2D, angle: number) {
  const compassR = 12
  const compassCx = MINIMAP_SIZE - compassR - 6
  const compassCy = compassR + 6
  const northAngle = -Math.PI / 2 + angle

  ctx.save()
  ctx.beginPath()
  ctx.arc(compassCx, compassCy, compassR, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.lineWidth = 1
  ctx.stroke()

  const tipX = compassCx + Math.cos(northAngle) * (compassR - 3)
  const tipY = compassCy + Math.sin(northAngle) * (compassR - 3)
  const leftAngle = northAngle + 2.6
  const rightAngle = northAngle - 2.6
  const baseR = compassR * 0.5

  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(compassCx + Math.cos(leftAngle) * baseR, compassCy + Math.sin(leftAngle) * baseR)
  ctx.lineTo(compassCx, compassCy)
  ctx.closePath()
  ctx.fillStyle = '#ef4444'
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(tipX, tipY)
  ctx.lineTo(compassCx + Math.cos(rightAngle) * baseR, compassCy + Math.sin(rightAngle) * baseR)
  ctx.lineTo(compassCx, compassCy)
  ctx.closePath()
  ctx.fillStyle = '#991b1b'
  ctx.fill()

  ctx.font = 'bold 8px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffffff'
  ctx.fillText('N', tipX + Math.cos(northAngle) * 1, tipY + Math.sin(northAngle) * 1)
  ctx.restore()
}
