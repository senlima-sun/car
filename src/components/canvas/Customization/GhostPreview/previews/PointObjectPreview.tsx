import {
  getRoadCenterPositionAt,
  getRoadEdgePositionAt,
  type RoadEdgeHitResult,
  type RoadEdgeResult,
} from '@/stores/useCustomizationStore'
import {
  Checkpoint,
  Cone,
  CornerMarker,
  CurbPreview,
  CurvedCurbPreview,
  PitBox,
  Ramp,
} from '../../../TrackObjects'
import { PIT_BOX_WIDTH, PIT_ROAD_WIDTH } from '@/constants/trackObjects'

type CurbDragState = {
  road: Parameters<typeof getRoadEdgePositionAt>[0]
  edge: 'left' | 'right'
  startT: number
}

export function PointObjectPreview({
  selectedObjectType,
  previewPosition,
  previewRotation,
  placementState,
  checkpointRoadEdge,
  curbEdgeHover,
  curbDragState,
  curbPreviewEndT,
  curbPreviewEndPosition,
}: {
  selectedObjectType: string
  previewPosition: [number, number, number]
  previewRotation: number
  placementState: string
  checkpointRoadEdge: RoadEdgeResult | null
  curbEdgeHover: RoadEdgeHitResult | null
  curbDragState: CurbDragState | null
  curbPreviewEndT: number | null
  curbPreviewEndPosition: [number, number, number] | null
}) {
  const commonProps = {
    position: previewPosition,
    rotation: previewRotation,
    isGhost: true as const,
  }

  switch (selectedObjectType) {
    case 'cone':
      return <Cone {...commonProps} />
    case 'ramp':
      return <Ramp {...commonProps} />
    case 'corner':
      return <CornerMarker {...commonProps} cornerNumber={0} />
    case 'checkpoint': {
      if (checkpointRoadEdge) {
        return (
          <Checkpoint
            position={checkpointRoadEdge.centerPoint}
            startPoint={checkpointRoadEdge.leftEdge}
            endPoint={checkpointRoadEdge.rightEdge}
            isGhost
          />
        )
      }
      return (
        <mesh position={[previewPosition[0], 0.2, previewPosition[2]]}>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshStandardMaterial color='#ffaa00' transparent opacity={0.7} />
        </mesh>
      )
    }
    case 'curb':
      if (
        placementState === 'curbDragging' &&
        curbDragState &&
        curbPreviewEndT !== null &&
        curbPreviewEndPosition
      ) {
        const parentRoad = curbDragState.road
        const startT = Math.min(curbDragState.startT, curbPreviewEndT)
        const endT = Math.max(curbDragState.startT, curbPreviewEndT)

        if (parentRoad.trackMode === 'curve' && parentRoad.controlPoint) {
          return (
            <CurvedCurbPreview
              parentRoad={parentRoad}
              edge={curbDragState.edge}
              startT={startT}
              endT={endT}
              isGhost
            />
          )
        }
        const startPos = getRoadEdgePositionAt(parentRoad, curbDragState.edge, startT)
        const endPos = getRoadEdgePositionAt(parentRoad, curbDragState.edge, endT)
        return (
          <CurbPreview
            startPosition={startPos}
            endPosition={endPos}
            edge={curbDragState.edge}
            isGhost
          />
        )
      }

      if (placementState === 'selecting' && curbEdgeHover) {
        return <CurbHoverHighlight curbEdgeHover={curbEdgeHover} />
      }
      return null
    case 'pitbox':
      if (
        placementState === 'curbDragging' &&
        curbDragState &&
        curbPreviewEndT !== null &&
        curbPreviewEndPosition
      ) {
        const parentRoad = curbDragState.road
        if (!parentRoad.startPoint || !parentRoad.endPoint) return null

        const startT = Math.min(curbDragState.startT, curbPreviewEndT)
        const endT = Math.max(curbDragState.startT, curbPreviewEndT)
        const midT = (startT + endT) / 2

        const centerPos = getRoadCenterPositionAt(parentRoad, midT)

        const dx = parentRoad.endPoint[0] - parentRoad.startPoint[0]
        const dz = parentRoad.endPoint[2] - parentRoad.startPoint[2]
        const length = Math.sqrt(dx * dx + dz * dz)
        if (length === 0) return null

        const dirX = dx / length
        const dirZ = dz / length
        const perpX = -dirZ
        const perpZ = dirX

        const halfRoadWidth = PIT_ROAD_WIDTH / 2
        const pitBoxHalfWidth = PIT_BOX_WIDTH / 2
        const edgeSign = curbDragState.edge === 'left' ? 1 : -1
        const offsetDist = halfRoadWidth + pitBoxHalfWidth

        const pitBoxPos: [number, number, number] = [
          centerPos[0] + perpX * edgeSign * offsetDist,
          centerPos[1],
          centerPos[2] + perpZ * edgeSign * offsetDist,
        ]

        const roadRotation = Math.atan2(dx, dz)

        return <PitBox position={pitBoxPos} rotation={roadRotation} isGhost />
      }

      if (placementState === 'selecting' && curbEdgeHover) {
        return <CurbHoverHighlight curbEdgeHover={curbEdgeHover} />
      }
      return null
    case 'grass_patch':
    case 'gravel_patch':
      return null
    default:
      return null
  }
}

function CurbHoverHighlight({ curbEdgeHover }: { curbEdgeHover: RoadEdgeHitResult }) {
  return (
    <>
      <mesh
        position={[
          curbEdgeHover.worldPosition[0],
          curbEdgeHover.worldPosition[1] + 0.1,
          curbEdgeHover.worldPosition[2],
        ]}
      >
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color='#ff6600' transparent opacity={0.8} />
      </mesh>
      <mesh
        position={[
          curbEdgeHover.worldPosition[0],
          curbEdgeHover.worldPosition[1] + 0.05,
          curbEdgeHover.worldPosition[2],
        ]}
      >
        <ringGeometry args={[0.8, 1.0, 16]} />
        <meshBasicMaterial color='#ff6600' transparent opacity={0.6} side={2} />
      </mesh>
    </>
  )
}
