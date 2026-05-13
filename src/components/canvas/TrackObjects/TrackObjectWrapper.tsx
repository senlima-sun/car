import { memo } from 'react'
import type { PlacedObject } from '../../../stores/useCustomizationStore'
import { useGameStore } from '../../../stores/useGameStore'
import { isPitRoad, isCurveMode } from '../../../types/trackObjects'
import Cone from './Cone'
import Ramp from './Ramp'
import Checkpoint from './Checkpoint'
import CornerMarker from './CornerMarker'
import Barrier from './Barrier'
import RoadSegment from './RoadSegment'
import TrackRibbon from './TrackRibbon'
import CurvedRoadSegment from './CurvedRoadSegment'
import PitRoadSegment from './PitRoadSegment'
import CurvedPitRoadSegment from './CurvedPitRoadSegment'
import CurvedBarrier from './CurvedBarrier'
import PitBox from './PitBox'
import CurbSegment from './CurbSegment'
import CurvedCurbSegment from './CurvedCurbSegment'
import RibbonCurbSegment from './RibbonCurbSegment'
import SurfacePatch from './SurfacePatch'
import PaintedArea from './PaintedArea'
import EdgeLine from './EdgeLine'
import Wall from './Wall'
import WallFence from './WallFence'
import SelectionHighlight from './SelectionHighlight'
import FlowArrows from './FlowArrows'
import { useParentRibbon } from './useParentRibbon'

interface TrackObjectWrapperProps {
  object: PlacedObject
  parentRoad?: PlacedObject
  allObjects?: readonly PlacedObject[]
  enablePhysics?: boolean
  isGhost?: boolean
  isSelected?: boolean
  isSelectedForCurb?: boolean
}

const EMPTY_OBJECTS: readonly PlacedObject[] = []

function TrackObjectWrapper({
  object,
  parentRoad,
  allObjects = EMPTY_OBJECTS,
  enablePhysics = true,
  isGhost = false,
  isSelected = false,
  isSelectedForCurb = false,
}: TrackObjectWrapperProps) {
  const parentRibbon = useParentRibbon(object.parentRibbonId, allObjects)
  const isCustomizeMode = useGameStore(s => s.status) === 'customize'

  const commonProps = {
    position: object.position,
    rotation: object.rotation,
    isGhost: isGhost || !enablePhysics,
  }

  const linearProps = {
    ...commonProps,
    startPoint: object.startPoint,
    endPoint: object.endPoint,
  }

  const curvedProps = {
    ...linearProps,
    controlPoint: object.controlPoint,
    startLeftEdge: object.startLeftEdge,
    startRightEdge: object.startRightEdge,
    endLeftEdge: object.endLeftEdge,
    endRightEdge: object.endRightEdge,
  }

  let component: React.ReactElement | null = null

  switch (object.type) {
    case 'cone':
      component = <Cone {...commonProps} />
      break
    case 'ramp':
      component = <Ramp {...commonProps} />
      break
    case 'checkpoint':
      component = (
        <Checkpoint
          {...linearProps}
          checkpointId={object.id}
          checkpointType={object.checkpointType ?? 'start-finish'}
          checkpointOrder={object.checkpointOrder ?? 0}
          flowDirection={object.flowDirection ?? null}
        />
      )
      break
    case 'corner':
      component = <CornerMarker {...commonProps} cornerNumber={object.cornerNumber ?? 1} />
      break
    case 'barrier':
      if (isCurveMode(object.trackMode) && object.controlPoint) {
        component = <CurvedBarrier {...(curvedProps as any)} />
      } else {
        component = <Barrier {...linearProps} />
      }
      break
    case 'road':
      if (isPitRoad(object.trackMode)) {
        if (isCurveMode(object.trackMode) && object.controlPoint) {
          component = (
            <CurvedPitRoadSegment
              {...(curvedProps as any)}
              width={object.width}
              startElevation={object.startElevation}
              endElevation={object.endElevation}
              banking={object.banking}
            />
          )
        } else {
          component = (
            <PitRoadSegment
              {...linearProps}
              width={object.width}
              startElevation={object.startElevation}
              endElevation={object.endElevation}
            />
          )
        }
      } else if (isCurveMode(object.trackMode) && object.controlPoint) {
        component = (
          <CurvedRoadSegment
            {...(curvedProps as any)}
            width={object.width}
            isSelectedForCurb={isSelectedForCurb}
            startElevation={object.startElevation}
            endElevation={object.endElevation}
            banking={object.banking}
          />
        )
      } else {
        component = (
          <RoadSegment
            {...linearProps}
            width={object.width}
            isSelectedForCurb={isSelectedForCurb}
            startElevation={object.startElevation}
            endElevation={object.endElevation}
            startLeftEdge={object.startLeftEdge}
            startRightEdge={object.startRightEdge}
            endLeftEdge={object.endLeftEdge}
            endRightEdge={object.endRightEdge}
          />
        )
      }
      break
    case 'track_ribbon':
      if (object.ribbonPoints && object.ribbonPoints.length >= 2) {
        component = (
          <TrackRibbon
            points={object.ribbonPoints}
            closed={object.ribbonClosed ?? false}
            width={object.width ?? 12}
            isGhost={isGhost}
          />
        )
      }
      break
    case 'curb':
      if (object.curbCenterline && object.curbCenterline.length >= 2) {
        component = <RibbonCurbSegment curb={object} isGhost={isGhost || !enablePhysics} />
      } else if (object.parentRoadId && parentRoad) {
        if (isCurveMode(parentRoad.trackMode) && parentRoad.controlPoint) {
          component = (
            <CurvedCurbSegment
              curb={object}
              parentRoad={parentRoad}
              isGhost={isGhost || !enablePhysics}
            />
          )
        } else {
          component = (
            <CurbSegment
              curb={object}
              parentRoad={parentRoad}
              isGhost={isGhost || !enablePhysics}
            />
          )
        }
      }
      break
    case 'pitbox':
      component = (
        <PitBox
          {...commonProps}
          parentRoadId={object.parentRoadId}
          edgeSide={object.edgeSide}
          startT={object.startT}
          endT={object.endT}
          width={object.width}
        />
      )
      break
    case 'wall':
      component = <Wall {...linearProps} adImageUrl={object.adImageUrl} />
      break
    case 'wall_fence':
      component = <WallFence {...linearProps} adImageUrl={object.adImageUrl} />
      break
    case 'grass_patch':
    case 'gravel_patch':
      component = (
        <SurfacePatch
          polygonPoints={object.polygonPoints}
          surfaceType={object.type as 'grass_patch' | 'gravel_patch'}
          isGhost={isGhost || !enablePhysics}
        />
      )
      break
    case 'painted_area':
      if (
        object.parentRibbonId ||
        (object.ribbonPoints && object.ribbonPoints.length >= 2)
      ) {
        component = (
          <PaintedArea
            placed={object}
            parentRibbon={parentRibbon}
            isGhost={isGhost || !enablePhysics}
          />
        )
      }
      break
    case 'edge_line':
      component = (
        <EdgeLine
          placed={object}
          parentRibbon={parentRibbon}
          isGhost={isGhost || !enablePhysics}
        />
      )
      break
    default:
      console.warn(`Unknown object type: ${object.type}`)
      return null
  }

  const showFlowArrows =
    isCustomizeMode &&
    !isGhost &&
    object.type === 'road' &&
    object.flowDirection &&
    object.startPoint &&
    object.endPoint

  return (
    <group>
      {component}
      {isSelected && <SelectionHighlight object={object} />}
      {showFlowArrows && (
        <FlowArrows
          startPoint={object.startPoint!}
          endPoint={object.endPoint!}
          controlPoint={object.controlPoint}
          flowDirection={object.flowDirection!}
          isCurve={isCurveMode(object.trackMode) && !!object.controlPoint}
          startElevation={object.startElevation}
          endElevation={object.endElevation}
          isSelected={isSelected}
        />
      )}
    </group>
  )
}

export default memo(TrackObjectWrapper, (prev, next) => {
  if (
    prev.parentRoad?.id !== next.parentRoad?.id ||
    prev.enablePhysics !== next.enablePhysics ||
    prev.isGhost !== next.isGhost ||
    prev.isSelected !== next.isSelected ||
    prev.isSelectedForCurb !== next.isSelectedForCurb
  ) {
    return false
  }

  const isParentDerived = next.object.parentRibbonId !== undefined
  if (isParentDerived) {
    return prev.object === next.object && prev.allObjects === next.allObjects
  }
  return prev.object.id === next.object.id
})
