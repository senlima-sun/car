import type { PlacedObject } from '../../../stores/useCustomizationStore'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useGameStore } from '../../../stores/useGameStore'
import { isPitRoad, isCurveMode } from '../../../types/trackObjects'
import Cone from './Cone'
import Ramp from './Ramp'
import Checkpoint from './Checkpoint'
import Barrier from './Barrier'
import RoadSegment from './RoadSegment'
import CurvedRoadSegment from './CurvedRoadSegment'
import PitRoadSegment from './PitRoadSegment'
import CurvedPitRoadSegment from './CurvedPitRoadSegment'
import CurvedBarrier from './CurvedBarrier'
import PitBox from './PitBox'
import CurbSegment from './CurbSegment'
import CurvedCurbSegment from './CurvedCurbSegment'
import SelectionHighlight from './SelectionHighlight'
import FlowArrows from './FlowArrows'

interface TrackObjectWrapperProps {
  object: PlacedObject
  enablePhysics?: boolean
  isGhost?: boolean
  isSelected?: boolean
  isSelectedForCurb?: boolean
}

export default function TrackObjectWrapper({
  object,
  enablePhysics = true,
  isGhost = false,
  isSelected = false,
  isSelectedForCurb = false,
}: TrackObjectWrapperProps) {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const isCustomizeMode = useGameStore(s => s.status) === 'customize'

  const commonProps = {
    position: object.position,
    rotation: object.rotation,
    isGhost: isGhost || !enablePhysics,
  }

  // For linear objects, pass start/end points
  const linearProps = {
    ...commonProps,
    startPoint: object.startPoint,
    endPoint: object.endPoint,
  }

  // For curved objects, also pass control point and snap edge positions
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
        />
      )
      break
    case 'barrier':
      // Check if it's a curved barrier
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
          />
        )
      }
      break
    case 'curb':
      // Find the parent road for this curb
      if (object.parentRoadId) {
        const parentRoad = placedObjects.find(obj => obj.id === object.parentRoadId)
        if (parentRoad) {
          // Use curved or straight curb component based on parent road type
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
