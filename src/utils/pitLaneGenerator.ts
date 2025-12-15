import { PlacedObject, isLinearObject } from '../stores/useCustomizationStore'
import { PitLaneData } from '../stores/usePitStore'

// Pit lane configuration constants
const PIT_OFFSET_DISTANCE = 20 // Distance from checkpoint to pit lane
const PIT_BOX_LENGTH = 15 // Length of pit box area
const PIT_BOX_WIDTH = 8 // Width of pit box
const ENTRY_EXIT_LENGTH = 12 // Length of entry/exit road segments
const COLLISION_BUFFER = 4 // Buffer for collision detection
const ROAD_WIDTH = 16 // Main road width
const ATTACHMENT_PERCENT = 0.25 // Percentage of road length before/after checkpoint for entry/exit (25%)

interface BoundingBox {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

// Get bounding box for a road/barrier segment
function getObjectBoundingBox(obj: PlacedObject): BoundingBox | null {
  if (!isLinearObject(obj.type) || !obj.startPoint || !obj.endPoint) {
    return null
  }

  const roadWidth = obj.type === 'road' ? 16 : 1 // Roads are wider

  // Calculate road direction
  const dx = obj.endPoint[0] - obj.startPoint[0]
  const dz = obj.endPoint[2] - obj.startPoint[2]
  const len = Math.sqrt(dx * dx + dz * dz)
  if (len === 0) return null

  // Perpendicular direction
  const perpX = -dz / len
  const perpZ = dx / len
  const halfWidth = roadWidth / 2

  // Get corner points
  const corners = [
    [obj.startPoint[0] + perpX * halfWidth, obj.startPoint[2] + perpZ * halfWidth],
    [obj.startPoint[0] - perpX * halfWidth, obj.startPoint[2] - perpZ * halfWidth],
    [obj.endPoint[0] + perpX * halfWidth, obj.endPoint[2] + perpZ * halfWidth],
    [obj.endPoint[0] - perpX * halfWidth, obj.endPoint[2] - perpZ * halfWidth],
  ]

  return {
    minX: Math.min(...corners.map(c => c[0])) - COLLISION_BUFFER,
    maxX: Math.max(...corners.map(c => c[0])) + COLLISION_BUFFER,
    minZ: Math.min(...corners.map(c => c[1])) - COLLISION_BUFFER,
    maxZ: Math.max(...corners.map(c => c[1])) + COLLISION_BUFFER,
  }
}

// Check if two bounding boxes overlap
function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxZ < b.minZ || a.minZ > b.maxZ)
}

// Get bounding box for proposed pit lane
function getPitLaneBoundingBox(
  pitBoxCenter: [number, number, number],
  rotation: number,
  pitBoxLength: number,
  pitBoxWidth: number,
  entryLength: number,
  exitLength: number,
): BoundingBox {
  // For simplicity, use a conservative bounding box
  const totalLength = entryLength + pitBoxLength + exitLength
  const totalWidth = pitBoxWidth + 4 // Extra buffer

  // Account for rotation (approximate)
  const cosR = Math.abs(Math.cos(rotation))
  const sinR = Math.abs(Math.sin(rotation))
  const effectiveWidth = totalWidth * cosR + totalLength * sinR
  const effectiveLength = totalLength * cosR + totalWidth * sinR

  return {
    minX: pitBoxCenter[0] - effectiveWidth / 2 - COLLISION_BUFFER,
    maxX: pitBoxCenter[0] + effectiveWidth / 2 + COLLISION_BUFFER,
    minZ: pitBoxCenter[2] - effectiveLength / 2 - COLLISION_BUFFER,
    maxZ: pitBoxCenter[2] + effectiveLength / 2 + COLLISION_BUFFER,
  }
}

// Find the road that the checkpoint is placed on
function findCheckpointRoad(
  checkpoint: PlacedObject,
  placedObjects: PlacedObject[],
): PlacedObject | null {
  if (!checkpoint.startPoint || !checkpoint.endPoint) return null

  // Checkpoint center
  const checkpointCenter: [number, number, number] = [
    (checkpoint.startPoint[0] + checkpoint.endPoint[0]) / 2,
    0,
    (checkpoint.startPoint[2] + checkpoint.endPoint[2]) / 2,
  ]

  for (const obj of placedObjects) {
    if (obj.type !== 'road' || !obj.startPoint || !obj.endPoint) continue
    // Skip curved roads for now
    if (obj.trackMode === 'curve') continue

    const roadStart = obj.startPoint
    const roadEnd = obj.endPoint

    // Road direction vector
    const dx = roadEnd[0] - roadStart[0]
    const dz = roadEnd[2] - roadStart[2]
    const roadLength = Math.sqrt(dx * dx + dz * dz)
    if (roadLength === 0) continue

    const dirX = dx / roadLength
    const dirZ = dz / roadLength

    // Vector from road start to checkpoint center
    const toCheckpointX = checkpointCenter[0] - roadStart[0]
    const toCheckpointZ = checkpointCenter[2] - roadStart[2]

    // Project checkpoint onto road line
    const projection = toCheckpointX * dirX + toCheckpointZ * dirZ

    // Check if projection is within road length
    if (projection < -2 || projection > roadLength + 2) continue

    // Find closest point on road center line
    const closestX = roadStart[0] + dirX * projection
    const closestZ = roadStart[2] + dirZ * projection

    // Perpendicular distance to road center
    const perpDist = Math.sqrt(
      Math.pow(checkpointCenter[0] - closestX, 2) + Math.pow(checkpointCenter[2] - closestZ, 2),
    )

    // Check if within road width (with some tolerance)
    if (perpDist <= ROAD_WIDTH / 2 + 2) {
      return obj
    }
  }

  return null
}

// Calculate attachment point on road edge
function calculateRoadEdgePoint(
  road: PlacedObject,
  t: number, // Parametric position along road (0-1)
  side: 'left' | 'right',
): [number, number, number] {
  if (!road.startPoint || !road.endPoint) return [0, 0, 0]

  const dx = road.endPoint[0] - road.startPoint[0]
  const dz = road.endPoint[2] - road.startPoint[2]
  const length = Math.sqrt(dx * dx + dz * dz)
  if (length === 0) return [0, 0, 0]

  const dirX = dx / length
  const dirZ = dz / length

  // Point on road center at parametric t
  const centerX = road.startPoint[0] + dx * t
  const centerZ = road.startPoint[2] + dz * t

  // Perpendicular direction (left side when looking from start to end)
  const perpX = -dirZ
  const perpZ = dirX
  const halfWidth = ROAD_WIDTH / 2

  const sign = side === 'left' ? 1 : -1
  return [centerX + perpX * halfWidth * sign, 0, centerZ + perpZ * halfWidth * sign]
}

// Generate pit lane data from checkpoint
export function generatePitLane(
  checkpoint: PlacedObject,
  placedObjects: PlacedObject[],
): PitLaneData | null {
  if (!checkpoint.startPoint || !checkpoint.endPoint) {
    return null
  }

  // Find the road the checkpoint is on
  const checkpointRoad = findCheckpointRoad(checkpoint, placedObjects)

  // Calculate checkpoint direction (along the line)
  const checkpointDx = checkpoint.endPoint[0] - checkpoint.startPoint[0]
  const checkpointDz = checkpoint.endPoint[2] - checkpoint.startPoint[2]
  const checkpointLen = Math.sqrt(checkpointDx * checkpointDx + checkpointDz * checkpointDz)

  if (checkpointLen === 0) return null

  // Normalize checkpoint direction
  const checkpointDirX = checkpointDx / checkpointLen
  const checkpointDirZ = checkpointDz / checkpointLen

  // Perpendicular direction (this is the direction cars drive through checkpoint)
  // The pit lane should be parallel to this
  const driveDir: [number, number] = [-checkpointDirZ, checkpointDirX]

  // Calculate pit lane rotation (direction cars drive)
  const pitRotation = Math.atan2(driveDir[0], driveDir[1])

  // Try placing pit lane on the right side first, then left
  const sides: Array<{ offset: [number, number]; side: 'left' | 'right' }> = [
    { offset: [checkpointDirX, checkpointDirZ], side: 'right' },
    { offset: [-checkpointDirX, -checkpointDirZ], side: 'left' },
  ]

  // Get all existing object bounding boxes
  const existingBoxes: BoundingBox[] = []
  for (const obj of placedObjects) {
    if (obj.id === checkpoint.id) continue
    const box = getObjectBoundingBox(obj)
    if (box) existingBoxes.push(box)
  }

  // Try different offsets if collision detected
  const offsets = [PIT_OFFSET_DISTANCE, PIT_OFFSET_DISTANCE * 1.5, PIT_OFFSET_DISTANCE * 2]

  for (const { offset: side, side: sideName } of sides) {
    for (const offset of offsets) {
      // Calculate pit box center position
      const pitBoxCenter: [number, number, number] = [
        checkpoint.position[0] + side[0] * offset,
        0,
        checkpoint.position[2] + side[1] * offset,
      ]

      // Get bounding box for proposed pit lane
      const pitBox = getPitLaneBoundingBox(
        pitBoxCenter,
        pitRotation,
        PIT_BOX_LENGTH,
        PIT_BOX_WIDTH,
        ENTRY_EXIT_LENGTH,
        ENTRY_EXIT_LENGTH,
      )

      // Check for collisions with existing objects
      let hasCollision = false
      for (const existingBox of existingBoxes) {
        if (boxesOverlap(pitBox, existingBox)) {
          hasCollision = true
          break
        }
      }

      if (!hasCollision) {
        // Calculate entry and exit positions
        const entryOffset = PIT_BOX_LENGTH / 2 + ENTRY_EXIT_LENGTH / 2
        const exitOffset = PIT_BOX_LENGTH / 2 + ENTRY_EXIT_LENGTH / 2

        const entryPoint: [number, number, number] = [
          pitBoxCenter[0] - driveDir[0] * entryOffset,
          0,
          pitBoxCenter[2] - driveDir[1] * entryOffset,
        ]

        const exitPoint: [number, number, number] = [
          pitBoxCenter[0] + driveDir[0] * exitOffset,
          0,
          pitBoxCenter[2] + driveDir[1] * exitOffset,
        ]

        // Entry road: from pit entry to pit box
        const entryRoadStart: [number, number, number] = [
          entryPoint[0] - driveDir[0] * ENTRY_EXIT_LENGTH,
          0,
          entryPoint[2] - driveDir[1] * ENTRY_EXIT_LENGTH,
        ]
        const entryRoadEnd: [number, number, number] = [
          pitBoxCenter[0] - (driveDir[0] * PIT_BOX_LENGTH) / 2,
          0,
          pitBoxCenter[2] - (driveDir[1] * PIT_BOX_LENGTH) / 2,
        ]

        // Exit road: from pit box to pit exit
        const exitRoadStart: [number, number, number] = [
          pitBoxCenter[0] + (driveDir[0] * PIT_BOX_LENGTH) / 2,
          0,
          pitBoxCenter[2] + (driveDir[1] * PIT_BOX_LENGTH) / 2,
        ]
        const exitRoadEnd: [number, number, number] = [
          exitPoint[0] + driveDir[0] * ENTRY_EXIT_LENGTH,
          0,
          exitPoint[2] + driveDir[1] * ENTRY_EXIT_LENGTH,
        ]

        // Calculate curved connection data if we found the checkpoint road
        let curvedConnectionData: Partial<PitLaneData> = {}

        if (checkpointRoad && checkpointRoad.startPoint && checkpointRoad.endPoint) {
          const roadDx = checkpointRoad.endPoint[0] - checkpointRoad.startPoint[0]
          const roadDz = checkpointRoad.endPoint[2] - checkpointRoad.startPoint[2]
          const roadLength = Math.sqrt(roadDx * roadDx + roadDz * roadDz)
          const roadDirX = roadDx / roadLength
          const roadDirZ = roadDz / roadLength

          // Find checkpoint's parametric position on road
          const toCheckpointX = checkpoint.position[0] - checkpointRoad.startPoint[0]
          const toCheckpointZ = checkpoint.position[2] - checkpointRoad.startPoint[2]
          const checkpointT = (toCheckpointX * roadDirX + toCheckpointZ * roadDirZ) / roadLength

          // Entry attachment: before checkpoint (in driving direction)
          const entryT = Math.max(0.05, checkpointT - ATTACHMENT_PERCENT)
          // Exit attachment: after checkpoint (in driving direction)
          const exitT = Math.min(0.95, checkpointT + ATTACHMENT_PERCENT)

          const entryAttachmentPoint = calculateRoadEdgePoint(checkpointRoad, entryT, sideName)
          const exitAttachmentPoint = calculateRoadEdgePoint(checkpointRoad, exitT, sideName)

          // Calculate pit box entry/exit points using roadDir (not driveDir which may be opposite)
          // Entry is at the back of pit box (where cars enter), exit is at front (where they leave)
          const pitBoxEntryPoint: [number, number, number] = [
            pitBoxCenter[0] - (roadDirX * PIT_BOX_LENGTH) / 2,
            0,
            pitBoxCenter[2] - (roadDirZ * PIT_BOX_LENGTH) / 2,
          ]
          const pitBoxExitPoint: [number, number, number] = [
            pitBoxCenter[0] + (roadDirX * PIT_BOX_LENGTH) / 2,
            0,
            pitBoxCenter[2] + (roadDirZ * PIT_BOX_LENGTH) / 2,
          ]

          // Entry control point: place on pit box side to make curve bulge toward pit
          const entryDx = pitBoxEntryPoint[0] - entryAttachmentPoint[0]
          const entryDz = pitBoxEntryPoint[2] - entryAttachmentPoint[2]
          const entryAlongRoad = entryDx * roadDirX + entryDz * roadDirZ
          const entryControlPoint: [number, number, number] = [
            pitBoxEntryPoint[0] - entryAlongRoad * roadDirX,
            0,
            pitBoxEntryPoint[2] - entryAlongRoad * roadDirZ,
          ]

          // Exit control point: place on pit box side to make curve bulge toward pit
          const exitDx = pitBoxExitPoint[0] - exitAttachmentPoint[0]
          const exitDz = pitBoxExitPoint[2] - exitAttachmentPoint[2]
          const exitAlongRoad = exitDx * roadDirX + exitDz * roadDirZ
          const exitControlPoint: [number, number, number] = [
            pitBoxExitPoint[0] - exitAlongRoad * roadDirX,
            0,
            pitBoxExitPoint[2] - exitAlongRoad * roadDirZ,
          ]

          curvedConnectionData = {
            entryAttachmentPoint,
            entryControlPoint,
            pitBoxEntry: pitBoxEntryPoint,
            exitAttachmentPoint,
            exitControlPoint,
            pitBoxExit: pitBoxExitPoint,
            parentRoadDirection: [roadDirX, 0, roadDirZ],
            attachmentSide: sideName,
          }
        }

        return {
          entryPoint,
          exitPoint,
          pitBoxCenter,
          rotation: pitRotation,
          pitBoxLength: PIT_BOX_LENGTH,
          pitBoxWidth: PIT_BOX_WIDTH,
          entryRoadStart,
          entryRoadEnd,
          exitRoadStart,
          exitRoadEnd,
          ...curvedConnectionData,
        }
      }
    }
  }

  // No valid position found
  return null
}
