import { memo } from 'react'
import type { PlacedObject } from '@/types/trackObjects'
import { buildCheckpointPath } from '../utils/svgPathBuilder'
import { getObjectStyle, SELECTION_COLOR } from '../utils/svgColors'
import { worldToSVG } from '../hooks/useSVGCoordinates'
import { getSectorColor } from '@/constants/trackObjects'

const RACE_GUIDE_LENGTH = 30

function buildRaceDirectionGuide(
  cp: PlacedObject,
  zoom: number,
): { path: string; labelX: number; labelY: number; labelAngle: number } | null {
  if (!cp.startPoint || !cp.endPoint || !cp.flowDirection) return null

  const midX = (cp.startPoint[0] + cp.endPoint[0]) / 2
  const midZ = (cp.startPoint[2] + cp.endPoint[2]) / 2
  const gateDX = cp.endPoint[0] - cp.startPoint[0]
  const gateDZ = cp.endPoint[2] - cp.startPoint[2]
  const gateLen = Math.sqrt(gateDX * gateDX + gateDZ * gateDZ)
  if (gateLen === 0) return null

  const perpX = -gateDZ / gateLen
  const perpZ = gateDX / gateLen
  const sign = cp.flowDirection === 'forward' ? 1 : -1

  const tipWorldX = midX + perpX * sign * RACE_GUIDE_LENGTH
  const tipWorldZ = midZ + perpZ * sign * RACE_GUIDE_LENGTH

  const [bx, by] = worldToSVG(midX, midZ)
  const [tx, ty] = worldToSVG(tipWorldX, tipWorldZ)

  const dx = tx - bx
  const dy = ty - by
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return null
  const ux = dx / len
  const uy = dy / len
  const nx = -uy
  const ny = ux
  const headSize = 4 / zoom
  const headBaseX = tx - ux * headSize
  const headBaseY = ty - uy * headSize
  const leftX = headBaseX + nx * headSize * 0.55
  const leftY = headBaseY + ny * headSize * 0.55
  const rightX = headBaseX - nx * headSize * 0.55
  const rightY = headBaseY - ny * headSize * 0.55

  const tick = 2 / zoom
  const tickAX = bx + nx * tick
  const tickAY = by + ny * tick
  const tickBX = bx - nx * tick
  const tickBY = by - ny * tick

  const path =
    `M ${tickAX} ${tickAY} L ${tickBX} ${tickBY} ` +
    `M ${bx} ${by} L ${tx} ${ty} ` +
    `M ${leftX} ${leftY} L ${tx} ${ty} L ${rightX} ${rightY}`

  const labelPosT = 0.55
  const labelAngle = Math.atan2(uy, ux) * (180 / Math.PI)
  const labelNormalOffset = 2.4 / zoom
  return {
    path,
    labelX: bx + ux * (len * labelPosT) + nx * labelNormalOffset,
    labelY: by + uy * (len * labelPosT) + ny * labelNormalOffset,
    labelAngle,
  }
}

interface SVGCheckpointLayerProps {
  checkpoints: PlacedObject[]
  selectedId: string | null
  zoom: number
}

export const SVGCheckpointLayer = memo(function SVGCheckpointLayer({
  checkpoints,
  selectedId,
  zoom,
}: SVGCheckpointLayerProps) {
  const style = getObjectStyle('checkpoint')

  return (
    <g>
      {checkpoints.map(cp => {
        const d = buildCheckpointPath(cp)
        if (!d) return null

        const isSelected = cp.id === selectedId
        const isStartFinish = (cp.checkpointType ?? 'start-finish') === 'start-finish'
        const labelPos = cp.position
        const [lx, ly] = worldToSVG(labelPos[0], labelPos[2])

        const sectorColor = isStartFinish ? '#ffffff' : getSectorColor(cp.checkpointOrder)
        const strokeColor = isStartFinish ? '#ffffff' : sectorColor
        const labelText = isStartFinish ? 'S/F' : `S${cp.checkpointOrder ?? ''}`

        const sfStrokeWidth = (style.strokeWidth ?? 0.3) * 2.4
        const sectorStrokeWidth = (style.strokeWidth ?? 0.3) * 1.4
        const badgeW = (isStartFinish ? 13 : 9.5) / zoom
        const badgeH = (isStartFinish ? 8 : 6) / zoom
        const badgeR = 2.0 / zoom
        const fontSize = (isStartFinish ? 5.4 : 4.2) / zoom
        const badgeGap = 1.8 / zoom
        const textBaseline = badgeGap + badgeH * 0.33

        const raceGuide = isStartFinish ? buildRaceDirectionGuide(cp, zoom) : null

        return (
          <g key={cp.id} data-object-id={cp.id}>
            {isSelected && (
              <path
                d={d}
                fill='none'
                stroke={SELECTION_COLOR}
                strokeWidth={1 / zoom}
                opacity={0.6}
              />
            )}
            {raceGuide && (
              <g style={{ pointerEvents: 'none' }}>
                <path
                  d={raceGuide.path}
                  fill='none'
                  stroke='#000000'
                  strokeWidth={2.2 / zoom}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  opacity={0.45}
                />
                <path
                  d={raceGuide.path}
                  fill='none'
                  stroke='#ffe55c'
                  strokeWidth={1.3 / zoom}
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  opacity={0.95}
                />
                <text
                  x={raceGuide.labelX}
                  y={raceGuide.labelY}
                  fill='#ffe55c'
                  fontSize={2.4 / zoom}
                  fontWeight={700}
                  textAnchor='middle'
                  dominantBaseline='middle'
                  transform={`rotate(${raceGuide.labelAngle} ${raceGuide.labelX} ${raceGuide.labelY})`}
                  stroke='#000000'
                  strokeWidth={0.4 / zoom}
                  paintOrder='stroke'
                >
                  RACE
                </text>
              </g>
            )}
            {!isStartFinish && (
              <path
                d={d}
                fill='none'
                stroke={strokeColor}
                strokeWidth={sectorStrokeWidth * 3}
                strokeLinecap='round'
                opacity={0.1}
              />
            )}
            <path
              d={d}
              fill='none'
              stroke={strokeColor}
              strokeWidth={isStartFinish ? sfStrokeWidth : sectorStrokeWidth}
              strokeDasharray={isStartFinish ? undefined : `${1.4 / zoom} ${0.9 / zoom}`}
              strokeLinecap='round'
              opacity={isStartFinish ? 1 : 0.9}
            />
            <rect
              x={lx - badgeW / 2}
              y={ly - badgeH - badgeGap}
              width={badgeW}
              height={badgeH}
              rx={badgeR}
              ry={badgeR}
              fill='#0a0a12'
              stroke={strokeColor}
              strokeWidth={(isStartFinish ? 0.7 : 0.45) / zoom}
              opacity={0.94}
              style={{ pointerEvents: 'none' }}
            />
            <text
              x={lx}
              y={ly - textBaseline}
              fill={strokeColor}
              fontSize={fontSize}
              fontWeight={isStartFinish ? 800 : 700}
              textAnchor='middle'
              dominantBaseline='middle'
              style={{ pointerEvents: 'none' }}
            >
              {labelText}
            </text>
          </g>
        )
      })}
    </g>
  )
})
