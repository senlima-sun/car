import { useMemo } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { usePitStore } from '../../../stores/usePitStore'
import { PIT_BOX_LENGTH, PIT_BOX_WIDTH, GHOST_OPACITY } from '../../../constants/trackObjects'

interface PitBoxProps {
  position: [number, number, number]
  rotation: number
  isGhost?: boolean
  startPoint?: [number, number, number]
  endPoint?: [number, number, number]
  parentRoadId?: string
  edgeSide?: 'left' | 'right'
  startT?: number
  endT?: number
  width?: number
}

const SURFACE_COLOR = '#1a1a1a'
const MARKING_COLOR = '#ff6600'
const BOUNDARY_THICKNESS = 0.3
const DASH_COUNT = 6
const SURFACE_Y = 0.01
const MARKING_Y = 0.02

export default function PitBox({
  position,
  rotation,
  isGhost = false,
  width: widthProp,
}: PitBoxProps) {
  const boxLength = PIT_BOX_LENGTH
  const boxWidth = widthProp ?? PIT_BOX_WIDTH

  const dashMarkings = useMemo(() => {
    const dashes: Array<{
      xOffset: number
      zOffset: number
      size: [number, number]
    }> = []

    const dashLength = (boxLength / DASH_COUNT) * 0.6
    const halfLength = boxLength / 2
    const halfWidth = boxWidth / 2

    for (let i = 0; i < DASH_COUNT; i++) {
      const zOffset = -halfLength + (i + 0.5) * (boxLength / DASH_COUNT)

      dashes.push({
        xOffset: -halfWidth,
        zOffset,
        size: [BOUNDARY_THICKNESS, dashLength],
      })

      dashes.push({
        xOffset: halfWidth,
        zOffset,
        size: [BOUNDARY_THICKNESS, dashLength],
      })
    }

    return dashes
  }, [boxLength, boxWidth])

  const materialProps = (color: string, emissive = false) => ({
    color,
    ...(emissive && { emissive: color, emissiveIntensity: 0.2 }),
    transparent: isGhost,
    opacity: isGhost ? GHOST_OPACITY : 1,
    depthWrite: !isGhost,
  })

  const pitTextMaterialProps = {
    color: MARKING_COLOR,
    emissive: MARKING_COLOR,
    emissiveIntensity: 0.3,
    transparent: isGhost,
    opacity: isGhost ? GHOST_OPACITY : 1,
    depthWrite: !isGhost,
  }

  const visuals = (
    <group>
      <mesh
        position={[0, SURFACE_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow={!isGhost}
      >
        <planeGeometry args={[boxWidth, boxLength]} />
        <meshStandardMaterial {...materialProps(SURFACE_COLOR)} />
      </mesh>

      <mesh position={[0, MARKING_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 1.5]} />
        <meshStandardMaterial {...pitTextMaterialProps} />
      </mesh>

      <mesh
        position={[0, MARKING_Y, -boxLength / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[boxWidth, BOUNDARY_THICKNESS]} />
        <meshStandardMaterial {...materialProps(MARKING_COLOR, true)} />
      </mesh>

      <mesh
        position={[0, MARKING_Y, boxLength / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[boxWidth, BOUNDARY_THICKNESS]} />
        <meshStandardMaterial {...materialProps(MARKING_COLOR, true)} />
      </mesh>

      {dashMarkings.map((dash, i) => (
        <mesh
          key={i}
          position={[dash.xOffset, MARKING_Y, dash.zOffset]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={dash.size} />
          <meshStandardMaterial {...materialProps(MARKING_COLOR, true)} />
        </mesh>
      ))}
    </group>
  )

  if (isGhost) {
    return (
      <group position={position} rotation={[0, rotation, 0]}>
        {visuals}
      </group>
    )
  }

  const handleEnter = () => {
    usePitStore.getState().enterPitBox()
  }

  const handleExit = () => {
    usePitStore.getState().exitPitBox()
  }

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {visuals}
      <RigidBody type='fixed' colliders={false} sensor>
        <CuboidCollider
          args={[boxWidth / 2, 2, boxLength / 2]}
          sensor
          onIntersectionEnter={handleEnter}
          onIntersectionExit={handleExit}
        />
      </RigidBody>
    </group>
  )
}
