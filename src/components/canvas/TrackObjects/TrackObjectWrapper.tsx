import type { PlacedObject } from '../../../stores/useCustomizationStore'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import Cone from './Cone'
import Ramp from './Ramp'
import Checkpoint from './Checkpoint'
import Barrier from './Barrier'
import RoadSegment from './RoadSegment'
import CurvedRoadSegment from './CurvedRoadSegment'
import CurvedBarrier from './CurvedBarrier'
import CurbSegment from './CurbSegment'
import CurvedCurbSegment from './CurvedCurbSegment'
import SelectionHighlight from './SelectionHighlight'

interface TrackObjectWrapperProps {
  object: PlacedObject
  enablePhysics?: boolean
  isGhost?: boolean
  isSelected?: boolean
}

export default function TrackObjectWrapper({
  object,
  enablePhysics = true,
  isGhost = false,
  isSelected = false,
}: TrackObjectWrapperProps) {
  // Get placedObjects for finding parent roads (used by curbs)
  const placedObjects = useCustomizationStore(s => s.placedObjects)

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
      // Checkpoint uses start/end points for road-spanning stroke
      component = <Checkpoint {...linearProps} checkpointId={object.id} />
      break
    case 'barrier':
      // Check if it's a curved barrier
      if (object.trackMode === 'curve' && object.controlPoint) {
        component = <CurvedBarrier {...(curvedProps as any)} />
      } else {
        component = <Barrier {...linearProps} />
      }
      break
    case 'road':
      // Check if it's a curved road
      if (object.trackMode === 'curve' && object.controlPoint) {
        component = <CurvedRoadSegment {...(curvedProps as any)} />
      } else {
        component = <RoadSegment {...linearProps} />
      }
      break
    case 'curb':
      // Find the parent road for this curb
      if (object.parentRoadId) {
        const parentRoad = placedObjects.find(obj => obj.id === object.parentRoadId)
        if (parentRoad) {
          // Use curved or straight curb component based on parent road type
          if (parentRoad.trackMode === 'curve' && parentRoad.controlPoint) {
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
    default:
      console.warn(`Unknown object type: ${object.type}`)
      return null
  }

  return (
    <group>
      {component}
      {isSelected && <SelectionHighlight object={object} />}
    </group>
  )
}
