import { PlacedObject } from '../stores/useCustomizationStore'

// Constants for curb positioning along road (parametric t values 0-1)
export const CURB_POSITIONS = {
  apex: { startT: 0.3, endT: 0.7 }, // Inside of curve - center 40%
  entryOnCurve: { startT: 0.0, endT: 0.35 }, // Outside of curve start
  exitOnCurve: { startT: 0.65, endT: 1.0 }, // Outside of curve end
  entryOnStraight: { startT: 0.7, endT: 1.0 }, // End of straight before curve
  exitOnStraight: { startT: 0.0, endT: 0.3 }, // Start of straight after curve
}

const SNAP_THRESHOLD = 2 // Distance to consider roads connected

// Generate unique ID for new curbs
const generateId = () => `curb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

/**
 * Detect turn direction of a curved road using cross product
 * Returns 'left' if turning left, 'right' if turning right, null if not a curve
 */
export function getTurnDirection(road: PlacedObject): 'left' | 'right' | null {
  if (road.trackMode !== 'curve' || !road.controlPoint || !road.startPoint || !road.endPoint) {
    return null
  }

  // Vectors: start->control and control->end
  const v1 = [road.controlPoint[0] - road.startPoint[0], road.controlPoint[2] - road.startPoint[2]]
  const v2 = [road.endPoint[0] - road.controlPoint[0], road.endPoint[2] - road.controlPoint[2]]

  // 2D cross product: v1.x * v2.y - v1.y * v2.x
  const cross = v1[0] * v2[1] - v1[1] * v2[0]

  // Positive cross = counter-clockwise = left turn
  // Negative cross = clockwise = right turn
  return cross > 0 ? 'left' : 'right'
}

/**
 * Get the inside and outside edges based on turn direction
 */
function getEdges(turnDirection: 'left' | 'right'): {
  insideEdge: 'left' | 'right'
  outsideEdge: 'left' | 'right'
} {
  if (turnDirection === 'left') {
    return { insideEdge: 'left', outsideEdge: 'right' }
  } else {
    return { insideEdge: 'right', outsideEdge: 'left' }
  }
}

/**
 * Calculate distance between two points
 */
function distance(p1: [number, number, number], p2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2) + Math.pow(p1[2] - p2[2], 2)
  )
}

/**
 * Check if two roads are connected (their endpoints are within SNAP_THRESHOLD)
 * Returns connection info if connected, null otherwise
 */
interface ConnectionInfo {
  curveRoad: PlacedObject
  straightRoad: PlacedObject
  curveEnd: 'start' | 'end' // Which end of the curve connects to the straight
  straightEnd: 'start' | 'end' // Which end of the straight connects to the curve
}

function findConnectedStraight(
  curveRoad: PlacedObject,
  curveEnd: 'start' | 'end',
  allRoads: PlacedObject[],
  selectedIds: string[]
): ConnectionInfo | null {
  if (!curveRoad.startPoint || !curveRoad.endPoint) return null

  const curvePoint = curveEnd === 'start' ? curveRoad.startPoint : curveRoad.endPoint

  for (const road of allRoads) {
    // Only check straight roads in selection
    if (road.trackMode !== 'straight' || !selectedIds.includes(road.id)) continue
    if (!road.startPoint || !road.endPoint) continue

    // Check if start of straight connects to curve
    if (distance(road.startPoint, curvePoint) < SNAP_THRESHOLD) {
      return {
        curveRoad,
        straightRoad: road,
        curveEnd,
        straightEnd: 'start',
      }
    }

    // Check if end of straight connects to curve
    if (distance(road.endPoint, curvePoint) < SNAP_THRESHOLD) {
      return {
        curveRoad,
        straightRoad: road,
        curveEnd,
        straightEnd: 'end',
      }
    }
  }

  return null
}

/**
 * Create a curb object
 */
function createCurb(
  parentRoadId: string,
  edgeSide: 'left' | 'right',
  startT: number,
  endT: number
): PlacedObject {
  return {
    id: generateId(),
    type: 'curb',
    position: [0, 0, 0], // Position calculated from parent road at render time
    rotation: 0,
    parentRoadId,
    edgeSide,
    startT,
    endT,
  }
}

/**
 * Main function: Generate curbs for selected roads
 */
export function generateCurbsForRoads(
  selectedRoadIds: string[],
  allObjects: PlacedObject[]
): PlacedObject[] {
  const roads = allObjects.filter(obj => selectedRoadIds.includes(obj.id) && obj.type === 'road')
  const generatedCurbs: PlacedObject[] = []

  // Track which straights have already been processed (to avoid duplicate curbs)
  const processedStraights = new Set<string>()

  for (const road of roads) {
    if (road.trackMode === 'curve') {
      // 1. Determine turn direction
      const turnDir = getTurnDirection(road)
      if (!turnDir) continue

      const { insideEdge, outsideEdge } = getEdges(turnDir)

      // 2. Generate apex curb (inside of curve)
      generatedCurbs.push(
        createCurb(road.id, insideEdge, CURB_POSITIONS.apex.startT, CURB_POSITIONS.apex.endT)
      )

      // 3. Generate entry curb on curve (outside, start portion)
      generatedCurbs.push(
        createCurb(
          road.id,
          outsideEdge,
          CURB_POSITIONS.entryOnCurve.startT,
          CURB_POSITIONS.entryOnCurve.endT
        )
      )

      // 4. Generate exit curb on curve (outside, end portion)
      generatedCurbs.push(
        createCurb(
          road.id,
          outsideEdge,
          CURB_POSITIONS.exitOnCurve.startT,
          CURB_POSITIONS.exitOnCurve.endT
        )
      )

      // 5. Check for connected straight before the curve (entry transition)
      const beforeConnection = findConnectedStraight(road, 'start', allObjects, selectedRoadIds)
      if (beforeConnection && !processedStraights.has(beforeConnection.straightRoad.id)) {
        processedStraights.add(beforeConnection.straightRoad.id)
        // Entry curb: on outside edge, at end of straight leading into curve
        // If straight's end connects to curve's start, use endT=1.0
        // If straight's start connects to curve's start, use startT=0
        const straightStartT =
          beforeConnection.straightEnd === 'end'
            ? CURB_POSITIONS.entryOnStraight.startT
            : 1 - CURB_POSITIONS.entryOnStraight.endT
        const straightEndT =
          beforeConnection.straightEnd === 'end'
            ? CURB_POSITIONS.entryOnStraight.endT
            : 1 - CURB_POSITIONS.entryOnStraight.startT

        generatedCurbs.push(
          createCurb(beforeConnection.straightRoad.id, outsideEdge, straightStartT, straightEndT)
        )
      }

      // 6. Check for connected straight after the curve (exit transition)
      const afterConnection = findConnectedStraight(road, 'end', allObjects, selectedRoadIds)
      if (afterConnection && !processedStraights.has(afterConnection.straightRoad.id)) {
        processedStraights.add(afterConnection.straightRoad.id)
        // Exit curb: on outside edge, at start of straight leaving curve
        // If straight's start connects to curve's end, use startT=0
        // If straight's end connects to curve's end, use endT=1.0
        const straightStartT =
          afterConnection.straightEnd === 'start'
            ? CURB_POSITIONS.exitOnStraight.startT
            : 1 - CURB_POSITIONS.exitOnStraight.endT
        const straightEndT =
          afterConnection.straightEnd === 'start'
            ? CURB_POSITIONS.exitOnStraight.endT
            : 1 - CURB_POSITIONS.exitOnStraight.startT

        generatedCurbs.push(
          createCurb(afterConnection.straightRoad.id, outsideEdge, straightStartT, straightEndT)
        )
      }
    }
    // Straight roads only get curbs if connected to curves (handled above)
  }

  return generatedCurbs
}
