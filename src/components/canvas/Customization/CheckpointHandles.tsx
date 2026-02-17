import { useState, useCallback, useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useCustomizationStore } from '../../../stores/useCustomizationStore'
import { useEditorStore } from '../../../stores/useEditorStore'

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

export default function CheckpointHandles() {
  const placedObjects = useCustomizationStore(s => s.placedObjects)
  const selectedObjectId = useEditorStore(s => s.selectedObjectId)
  const checkpointDragState = useEditorStore(s => s.checkpointDragState)
  const startCheckpointDrag = useEditorStore(s => s.startCheckpointDrag)
  const updateCheckpointDrag = useEditorStore(s => s.updateCheckpointDrag)
  const confirmCheckpointDrag = useEditorStore(s => s.confirmCheckpointDrag)
  const cancelCheckpointDrag = useEditorStore(s => s.cancelCheckpointDrag)
  const { camera } = useThree()

  const selectedCheckpoint = useMemo(() => {
    if (!selectedObjectId) return null
    const obj = placedObjects.find(o => o.id === selectedObjectId)
    if (!obj || obj.type !== 'checkpoint') return null
    return obj
  }, [selectedObjectId, placedObjects])

  const isDraggingRef = useRef(false)
  isDraggingRef.current = !!checkpointDragState

  const handlePointerDown = useCallback(
    (handle: 'start' | 'end' | 'center') => {
      if (!selectedCheckpoint?.startPoint || !selectedCheckpoint?.endPoint) return
      startCheckpointDrag(
        selectedCheckpoint.id,
        handle,
        selectedCheckpoint.startPoint,
        selectedCheckpoint.endPoint,
      )
      document.body.style.cursor = 'grabbing'
    },
    [selectedCheckpoint, startCheckpointDrag],
  )

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingRef.current) return
      const ndcX = (e.clientX / window.innerWidth) * 2 - 1
      const ndcY = -(e.clientY / window.innerHeight) * 2 + 1
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
      if (raycaster.ray.intersectPlane(GROUND_PLANE, intersection)) {
        updateCheckpointDrag([intersection.x, 0, intersection.z])
      }
    },
    [camera, updateCheckpointDrag],
  )

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return
    document.body.style.cursor = 'auto'
    confirmCheckpointDrag()
  }, [confirmCheckpointDrag])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.code === 'Escape' && isDraggingRef.current) {
        document.body.style.cursor = 'auto'
        cancelCheckpointDrag()
      }
    },
    [cancelCheckpointDrag],
  )

  const listenersAttached = useRef(false)

  useFrame(() => {
    if (checkpointDragState && !listenersAttached.current) {
      listenersAttached.current = true
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('keydown', handleKeyDown)
    } else if (!checkpointDragState && listenersAttached.current) {
      listenersAttached.current = false
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
    }
  })

  if (!selectedCheckpoint?.startPoint || !selectedCheckpoint?.endPoint) return null

  const start = selectedCheckpoint.startPoint
  const end = selectedCheckpoint.endPoint
  const center: [number, number, number] = [
    (start[0] + end[0]) / 2,
    0.3,
    (start[2] + end[2]) / 2,
  ]

  const sectorLabel =
    selectedCheckpoint.checkpointType === 'sector'
      ? `S${selectedCheckpoint.checkpointOrder ?? '?'}`
      : 'SF'

  return (
    <group>
      <Handle
        position={[start[0], 0.3, start[2]]}
        color='#22c55e'
        label={`${sectorLabel} Start`}
        onPointerDown={() => handlePointerDown('start')}
      />
      <Handle
        position={[end[0], 0.3, end[2]]}
        color='#ef4444'
        label={`${sectorLabel} End`}
        onPointerDown={() => handlePointerDown('end')}
      />
      <Handle
        position={center}
        color='#f59e0b'
        label={sectorLabel}
        onPointerDown={() => handlePointerDown('center')}
      />
    </group>
  )
}
