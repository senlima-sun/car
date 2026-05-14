import type { PlacedObject } from '@/types/trackObjects'
import type { MinimapTransforms } from '../helpers'

export function drawCheckpoints(
  ctx: CanvasRenderingContext2D,
  checkpoints: PlacedObject[],
  curSector: number | null,
  t: MinimapTransforms,
) {
  const { toScreenX, toScreenZ, rotX, rotZ } = t

  for (const cp of checkpoints) {
    const isStartFinish = (cp.checkpointType ?? 'start-finish') === 'start-finish'
    const isSector = cp.checkpointType === 'sector'
    const isCurrentSector = isSector && cp.checkpointOrder === curSector

    if (cp.startPoint && cp.endPoint) {
      const s0x = toScreenX(cp.startPoint[0])
      const s0z = toScreenZ(cp.startPoint[2])
      const e0x = toScreenX(cp.endPoint[0])
      const e0z = toScreenZ(cp.endPoint[2])
      const midX = (rotX(s0x, s0z) + rotX(e0x, e0z)) / 2
      const midZ = (rotZ(s0x, s0z) + rotZ(e0x, e0z)) / 2

      drawCheckpointDot(ctx, midX, midZ, isStartFinish, isCurrentSector)

      if (isSector && cp.checkpointOrder != null) {
        drawSectorLabel(ctx, midX, midZ, cp.checkpointOrder, isCurrentSector)
      }
    } else {
      const rawX = toScreenX(cp.position[0])
      const rawZ = toScreenZ(cp.position[2])
      const cx = rotX(rawX, rawZ)
      const cz = rotZ(rawX, rawZ)

      drawCheckpointDot(ctx, cx, cz, isStartFinish, isCurrentSector)

      if (isSector && cp.checkpointOrder != null) {
        drawSectorLabel(ctx, cx, cz, cp.checkpointOrder, isCurrentSector)
      }
    }
  }
}

function drawCheckpointDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  z: number,
  isStartFinish: boolean,
  isCurrentSector: boolean,
) {
  ctx.beginPath()
  if (isCurrentSector) {
    ctx.fillStyle = '#f87171'
    ctx.shadowColor = '#f87171'
    ctx.shadowBlur = 6
  } else {
    ctx.fillStyle = isStartFinish ? '#ffffff' : '#ef4444'
    ctx.shadowBlur = 0
  }
  ctx.arc(x, z, isStartFinish ? 5 : 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
}

function drawSectorLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  z: number,
  order: number,
  isCurrentSector: boolean,
) {
  ctx.font = 'bold 9px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillStyle = isCurrentSector ? '#f87171' : '#ef4444'
  ctx.fillText(`S${order}`, x, z - 6)
}
