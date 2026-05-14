import { useState, useCallback, useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'
import { isWallType } from '../../../types/trackObjects'

const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const raycaster = new THREE.Raycaster()
const intersection = new THREE.Vector3()

function Handle({
  position,
  color,
  label,
  onPointerDown,
}: {
  position: [number, number, number]
  color: string
  label: string
  onPointerDown: (e: THREE.Event) => void
}) {
  const [hovered, setHovered] = useState(false)
  const radius = hovered ? 0.7 : 0.5

  return (
    <group position={position}>
      <mesh
        onPointerOver={e => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'grab'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
        onPointerDown={e => {
          e.stopPropagation()
          onPointerDown(e)
        }}
      >
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.5 : 0.3}
        />
      </mesh>
      <Billboard position={[0, 1.2, 0]}>
        <Text
          fontSize={0.5}
          color='#fff'
          anchorX='center'
          anchorY='middle'
          outlineWidth={0.04}
          outlineColor='#000'
        >
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

interface WallDragState {
  wallId: string
  handle: 'start' | 'end' | 'center'
  initialStartPoint: [number, number, number]
  initialEndPoint: [number, number, number]
}

export default function WallHandles() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const updateObject = useCustomizationStore(s => s.updateObject)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const { camera } = useThree()

  const [dragState, setDragState] = useState<WallDragState | null>(null)

  const selectedWall = useMemo(() => {
    if (!selectedObjectId) return null
    const obj = placedObjects.find(o => o.id === selectedObjectId)
    if (!obj || !isWallType(obj.type)) return null
    return obj
  }, [selectedObjectId, placedObjects])

  const isDraggingRef = useRef(false)
  isDraggingRef.current = !!dragState

  const handlePointerDown = useCallback(
    (handle: 'start' | 'end' | 'center') => {
      if (!selectedWall?.startPoint || !selectedWall?.endPoint) return
      setDragState({
        wallId: selectedWall.id,
        handle,
        initialStartPoint: selectedWall.startPoint,
        initialEndPoint: selectedWall.endPoint,
      })
      document.body.style.cursor = 'grabbing'
    },
    [selectedWall],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingRef.current || !dragState) return
      const ndcX = (e.clientX / window.innerWidth) * 2 - 1
      const ndcY = -(e.clientY / window.innerHeight) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
      if (!raycaster.ray.intersectPlane(GROUND_PLANE, intersection)) return

      const worldPos: [number, number, number] = [intersection.x, 0, intersection.z]
      const obj = useCustomizationStore
        .getState()
        .placedObjects.find(o => o.id === dragState.wallId)
      if (!obj) return

      let newStart: [number, number, number]
      let newEnd: [number, number, number]

      if (dragState.handle === 'start') {
        newStart = worldPos
        newEnd = obj.endPoint ?? dragState.initialEndPoint
      } else if (dragState.handle === 'end') {
        newStart = obj.startPoint ?? dragState.initialStartPoint
        newEnd = worldPos
      } else {
        const curStart = obj.startPoint ?? dragState.initialStartPoint
        const curEnd = obj.endPoint ?? dragState.initialEndPoint
        const cx = (curStart[0] + curEnd[0]) / 2
        const cz = (curStart[2] + curEnd[2]) / 2
        const dx = worldPos[0] - cx
        const dz = worldPos[2] - cz
        newStart = [curStart[0] + dx, curStart[1], curStart[2] + dz]
        newEnd = [curEnd[0] + dx, curEnd[1], curEnd[2] + dz]
      }

      const position: [number, number, number] = [
        (newStart[0] + newEnd[0]) / 2,
        0,
        (newStart[2] + newEnd[2]) / 2,
      ]
      const rotation = Math.atan2(newEnd[0] - newStart[0], newEnd[2] - newStart[2])

      updateObject(dragState.wallId, {
        startPoint: newStart,
        endPoint: newEnd,
        position,
        rotation,
      })
    },
    [camera, dragState, updateObject],
  )

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return
    document.body.style.cursor = 'auto'
    setDragState(null)
  }, [])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Escape' && isDraggingRef.current && dragState) {
        document.body.style.cursor = 'auto'

        const position: [number, number, number] = [
          (dragState.initialStartPoint[0] + dragState.initialEndPoint[0]) / 2,
          0,
          (dragState.initialStartPoint[2] + dragState.initialEndPoint[2]) / 2,
        ]
        const rotation = Math.atan2(
          dragState.initialEndPoint[0] - dragState.initialStartPoint[0],
          dragState.initialEndPoint[2] - dragState.initialStartPoint[2],
        )

        updateObject(dragState.wallId, {
          startPoint: dragState.initialStartPoint,
          endPoint: dragState.initialEndPoint,
          position,
          rotation,
        })

        setDragState(null)
      }
    },
    [dragState, updateObject],
  )

  const listenersAttached = useRef(false)

  useFrame(() => {
    if (dragState && !listenersAttached.current) {
      listenersAttached.current = true
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('keydown', handleKeyDown)
    } else if (!dragState && listenersAttached.current) {
      listenersAttached.current = false
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  })

  if (!selectedWall?.startPoint || !selectedWall?.endPoint) return null

  const start = selectedWall.startPoint
  const end = selectedWall.endPoint
  const center: [number, number, number] = [(start[0] + end[0]) / 2, 0.3, (start[2] + end[2]) / 2]

  const label = selectedWall.type === 'wall_fence' ? 'WF' : 'W'

  return (
    <group>
      <Handle
        position={[start[0], 0.3, start[2]]}
        color='#22c55e'
        label={`${label} Start`}
        onPointerDown={() => handlePointerDown('start')}
      />
      <Handle
        position={[end[0], 0.3, end[2]]}
        color='#ef4444'
        label={`${label} End`}
        onPointerDown={() => handlePointerDown('end')}
      />
      <Handle
        position={center}
        color='#f59e0b'
        label={label}
        onPointerDown={() => handlePointerDown('center')}
      />
    </group>
  )
}
