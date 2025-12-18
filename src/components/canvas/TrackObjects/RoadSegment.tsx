import { useMemo, useCallback, useEffect } from 'react'
import { Vector3 } from 'three'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { OBJECT_CONFIGS, GHOST_OPACITY } from '../../../constants/trackObjects'
import { useSurfaceStore } from '../../../stores/useSurfaceStore'
import { useTrackTemperatureStore } from '../../../stores/useTrackTemperatureStore'
import { usePhysicsOptional } from '../../../wasm'

interface RoadSegmentProps {
  position: [number, number, number]
  rotation?: number
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  isGhost?: boolean
  isSelectedForCurb?: boolean
}

const config = OBJECT_CONFIGS.road
const ROAD_THICKNESS = 0.02 // 2cm - visible but car drives on ground

export default function RoadSegment({
  position,
  rotation = 0,
  startPoint,
  endPoint,
  isGhost = false,
  isSelectedForCurb = false,
}: RoadSegmentProps) {
  const { width } = config.defaultSize
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)
  const physics = usePhysicsOptional()
  const setRoadRegionTS = useTrackTemperatureStore(s => s.setRoadRegion)

  // Calculate length and rotation from start/end points if provided
  const { length, calculatedRotation, midpoint } = useMemo(() => {
    if (startPoint && endPoint) {
      const start = new Vector3(...startPoint)
      const end = new Vector3(...endPoint)
      const direction = end.clone().sub(start)
      const len = direction.length()
      const rot = Math.atan2(direction.x, direction.z)
      const mid: [number, number, number] = [(start.x + end.x) / 2, 0, (start.z + end.z) / 2]
      return { length: len, calculatedRotation: rot, midpoint: mid }
    }
    return { length: 10, calculatedRotation: rotation, midpoint: position }
  }, [startPoint, endPoint, rotation, position])

  const finalRotation = startPoint && endPoint ? calculatedRotation : rotation
  const finalPosition = startPoint && endPoint ? midpoint : position

  // Number of center line dashes
  const dashCount = Math.max(1, Math.floor(length / 3))

  // Surface detection callbacks
  const handleEnterRoad = useCallback(() => {
    enterSurface('road')
  }, [enterSurface])

  const handleExitRoad = useCallback(() => {
    exitSurface('road')
  }, [exitSurface])

  // Register road cells for temperature tracking
  // Roads retain heat better than non-road surfaces
  useEffect(() => {
    if (isGhost) return

    // Calculate world-space bounds of the road
    // Need to account for rotation when computing the bounding box
    const cos = Math.cos(finalRotation)
    const sin = Math.sin(finalRotation)
    const halfWidth = width / 2
    const halfLength = length / 2

    // Calculate the 4 corners in local space, then rotate
    const corners = [
      { x: -halfWidth, z: -halfLength },
      { x: halfWidth, z: -halfLength },
      { x: -halfWidth, z: halfLength },
      { x: halfWidth, z: halfLength },
    ].map(c => ({
      x: finalPosition[0] + c.x * cos - c.z * sin,
      z: finalPosition[2] + c.x * sin + c.z * cos,
    }))

    // Find axis-aligned bounding box
    const xs = corners.map(c => c.x)
    const zs = corners.map(c => c.z)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minZ = Math.min(...zs)
    const maxZ = Math.max(...zs)

    // Register as road region in WASM physics engine
    if (physics) {
      physics.setRoadRegion(minX, minZ, maxX, maxZ, true)
    }

    // Register as road region in TypeScript temperature store (for visualization)
    setRoadRegionTS(minX, minZ, maxX, maxZ, true)

    // Cleanup: unregister on unmount
    return () => {
      if (physics) {
        physics.setRoadRegion(minX, minZ, maxX, maxZ, false)
      }
      setRoadRegionTS(minX, minZ, maxX, maxZ, false)
    }
  }, [isGhost, physics, setRoadRegionTS, finalPosition, finalRotation, width, length])

  // Visual meshes
  const roadVisuals = (
    <>
      {/* Main road surface - box geometry with thickness */}
      <mesh position={[0, ROAD_THICKNESS / 2, 0]} receiveShadow={!isGhost} castShadow={!isGhost}>
        <boxGeometry args={[width, ROAD_THICKNESS, length]} />
        <meshStandardMaterial
          color={config.color}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Road edges - white lines */}
      <mesh position={[-width / 2 + 0.15, ROAD_THICKNESS + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, length]} />
        <meshStandardMaterial
          color='#ffffff'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>
      <mesh position={[width / 2 - 0.15, ROAD_THICKNESS + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.2, length]} />
        <meshStandardMaterial
          color='#ffffff'
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {/* Center line dashes - yellow */}
      {Array.from({ length: dashCount }).map((_, i) => (
        <mesh
          key={i}
          position={[0, ROAD_THICKNESS + 0.001, -length / 2 + (i + 0.5) * (length / dashCount)]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.15, (length / dashCount) * 0.6]} />
          <meshStandardMaterial
            color='#ffcc00'
            transparent={isGhost}
            opacity={isGhost ? GHOST_OPACITY : 1}
            depthWrite={!isGhost}
          />
        </mesh>
      ))}

      {/* Selection highlight for auto curb mode */}
      {isSelectedForCurb && (
        <mesh position={[0, ROAD_THICKNESS + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 0.5, length + 0.5]} />
          <meshBasicMaterial color='#22c55e' transparent opacity={0.3} depthWrite={false} />
        </mesh>
      )}
    </>
  )

  // Ghost mode - no physics
  if (isGhost) {
    return (
      <group position={[finalPosition[0], 0.02, finalPosition[2]]} rotation={[0, finalRotation, 0]}>
        {roadVisuals}
      </group>
    )
  }

  // Normal mode - with physics (ground provides collision, road only has sensor)
  return (
    <RigidBody
      type='fixed'
      position={[finalPosition[0], 0.01, finalPosition[2]]}
      rotation={[0, finalRotation, 0]}
      colliders={false}
    >
      {/* Surface detection sensor (slightly taller to catch jumping cars) */}
      <CuboidCollider
        args={[width / 2, 0.5, length / 2]}
        position={[0, 0.5, 0]}
        sensor
        onIntersectionEnter={handleEnterRoad}
        onIntersectionExit={handleExitRoad}
      />

      {roadVisuals}
    </RigidBody>
  )
}
