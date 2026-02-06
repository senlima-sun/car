import { useMemo, useCallback, useEffect } from 'react'
import { Vector3, BufferGeometry, Float32BufferAttribute } from 'three'
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
  width?: number
  startElevation?: number
  endElevation?: number
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
  width: widthProp,
  startElevation,
  endElevation,
}: RoadSegmentProps) {
  const width = widthProp ?? config.defaultSize.width
  const enterSurface = useSurfaceStore(s => s.enterSurface)
  const exitSurface = useSurfaceStore(s => s.exitSurface)
  const physics = usePhysicsOptional()
  const setRoadRegionTS = useTrackTemperatureStore(s => s.setRoadRegion)

  const { length, calculatedRotation, midpoint, startElev, endElev, midElev } = useMemo(() => {
    const startElevValue = startElevation ?? 0
    const endElevValue = endElevation ?? 0
    const midElevValue = (startElevValue + endElevValue) / 2

    if (startPoint && endPoint) {
      const start = new Vector3(...startPoint)
      const end = new Vector3(...endPoint)
      const direction = end.clone().sub(start)
      const len = direction.length()
      const rot = Math.atan2(direction.x, direction.z)
      const mid: [number, number, number] = [(start.x + end.x) / 2, midElevValue, (start.z + end.z) / 2]
      return {
        length: len,
        calculatedRotation: rot,
        midpoint: mid,
        startElev: startElevValue,
        endElev: endElevValue,
        midElev: midElevValue,
      }
    }
    return {
      length: 10,
      calculatedRotation: rotation,
      midpoint: position,
      startElev: startElevValue,
      endElev: endElevValue,
      midElev: midElevValue,
    }
  }, [startPoint, endPoint, rotation, position, startElevation, endElevation])

  const finalRotation = startPoint && endPoint ? calculatedRotation : rotation
  const finalPosition = startPoint && endPoint ? midpoint : position

  const dashCount = Math.max(1, Math.floor(length / 3))

  const slopeGeometry = useMemo(() => {
    const geo = new BufferGeometry()
    const hw = width / 2
    const hl = length / 2
    const startY = (startElev - midElev) + ROAD_THICKNESS
    const endY = (endElev - midElev) + ROAD_THICKNESS

    const vertices = new Float32Array([
      -hw, startY, -hl,
       hw, startY, -hl,
      -hw, endY,    hl,
       hw, endY,    hl,
    ])
    const indices = [0, 2, 1, 1, 2, 3]
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1])

    geo.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }, [width, length, startElev, endElev, midElev])

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

  const roadVisuals = (
    <>
      <mesh geometry={slopeGeometry} receiveShadow={!isGhost} castShadow={!isGhost}>
        <meshStandardMaterial
          color={config.color}
          transparent={isGhost}
          opacity={isGhost ? GHOST_OPACITY : 1}
          depthWrite={!isGhost}
        />
      </mesh>

      {Array.from({ length: dashCount }).map((_, i) => {
        const t = (i + 0.5) / dashCount
        const dashY = (startElev - midElev) + (endElev - startElev) * t + ROAD_THICKNESS + 0.001
        const dashZ = -length / 2 + (i + 0.5) * (length / dashCount)
        return (
          <mesh
            key={i}
            position={[0, dashY, dashZ]}
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
        )
      })}

      {isSelectedForCurb && (
        <mesh position={[0, (startElev + endElev) / 2 - midElev + ROAD_THICKNESS + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[width + 0.5, length + 0.5]} />
          <meshBasicMaterial color='#22c55e' transparent opacity={0.3} depthWrite={false} />
        </mesh>
      )}
    </>
  )

  if (isGhost) {
    return (
      <group position={finalPosition} rotation={[0, finalRotation, 0]}>
        {roadVisuals}
      </group>
    )
  }

  return (
    <RigidBody
      type='fixed'
      position={finalPosition}
      rotation={[0, finalRotation, 0]}
      colliders={false}
    >
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
