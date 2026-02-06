import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import { useEditorStore } from '@/stores/useEditorStore'

const INITIAL_ZOOM = 15
const MIN_ZOOM = 5
const MAX_ZOOM = 100
const PAN_SPEED = 0.5
const ZOOM_SPEED = 0.1
const KEYBOARD_PAN_SPEED = 2.5

export default function TopDownCamera() {
  const cameraRef = useRef<THREE.OrthographicCamera>(null)
  const { gl } = useThree()
  const setObliqueView = useEditorStore(s => s.setObliqueView)
  const isObliqueView = useEditorStore(s => s.isObliqueView)

  const elevationEditMode = useEditorStore(s => s.elevationEditMode)
  const isOblique = useRef(false)
  const azimuth = useRef(0)
  const targetAzimuth = useRef(0)

  const targetPosition = useRef(new THREE.Vector3(0, 200, 0))
  const currentPosition = useRef(new THREE.Vector3(0, 200, 0))

  const cameraState = useRef({
    x: 0,
    z: 0,
    zoom: INITIAL_ZOOM,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
  })

  useEffect(() => {
    if (elevationEditMode && !isOblique.current) {
      isOblique.current = true
      setObliqueView(true)
    }
  }, [elevationEditMode, setObliqueView])

  // Handle mouse wheel for zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 1 : -1
      cameraState.current.zoom = Math.max(
        MIN_ZOOM,
        Math.min(
          MAX_ZOOM,
          cameraState.current.zoom + delta * ZOOM_SPEED * cameraState.current.zoom,
        ),
      )
    }

    const canvas = gl.domElement
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [gl])

  // Handle mouse drag for panning
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        cameraState.current.isDragging = true
        cameraState.current.lastMouseX = e.clientX
        cameraState.current.lastMouseY = e.clientY
      }
    }

    const handleMouseUp = () => {
      cameraState.current.isDragging = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!cameraState.current.isDragging) return

      const deltaX = e.clientX - cameraState.current.lastMouseX
      const deltaY = e.clientY - cameraState.current.lastMouseY

      // Pan based on zoom level (further out = faster pan)
      const panFactor = cameraState.current.zoom * PAN_SPEED * 0.01
      cameraState.current.x -= deltaX * panFactor
      cameraState.current.z -= deltaY * panFactor

      cameraState.current.lastMouseX = e.clientX
      cameraState.current.lastMouseY = e.clientY
    }

    const canvas = gl.domElement
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseUp)
    canvas.addEventListener('mousemove', handleMouseMove)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseUp)
      canvas.removeEventListener('mousemove', handleMouseMove)
    }
  }, [gl])

  // Track pressed keys for WASD panning
  const keysRef = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true

      if (e.code === 'KeyV') {
        isOblique.current = !isOblique.current
        setObliqueView(isOblique.current)
      }
      if (e.code === 'KeyQ' && isOblique.current) {
        targetAzimuth.current += Math.PI / 4
      }
      if (e.code === 'KeyE' && isOblique.current) {
        targetAzimuth.current -= Math.PI / 4
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [setObliqueView])

  useFrame((_, delta) => {
    if (!cameraRef.current) return

    const keys = keysRef.current
    const panFactor = cameraState.current.zoom * KEYBOARD_PAN_SPEED * delta
    if (keys['KeyW'] || keys['ArrowUp']) cameraState.current.z -= panFactor
    if (keys['KeyS'] || keys['ArrowDown']) cameraState.current.z += panFactor
    if (keys['KeyA'] || keys['ArrowLeft']) cameraState.current.x -= panFactor
    if (keys['KeyD'] || keys['ArrowRight']) cameraState.current.x += panFactor

    azimuth.current += (targetAzimuth.current - azimuth.current) * 0.1

    const { x, z, zoom } = cameraState.current

    if (isOblique.current) {
      const elevAngle = (55 * Math.PI) / 180
      const dist = 200
      const camX = x + Math.sin(azimuth.current) * Math.cos(elevAngle) * dist
      const camY = Math.sin(elevAngle) * dist
      const camZ = z + Math.cos(azimuth.current) * Math.cos(elevAngle) * dist

      targetPosition.current.set(camX, camY, camZ)
    } else {
      targetPosition.current.set(x, 200, z)
    }

    currentPosition.current.lerp(targetPosition.current, 0.15)

    cameraRef.current.position.copy(currentPosition.current)

    if (isOblique.current) {
      cameraRef.current.lookAt(x, 0, z)
    } else {
      cameraRef.current.rotation.set(-Math.PI / 2, 0, 0)
    }

    cameraRef.current.zoom = zoom
    cameraRef.current.updateProjectionMatrix()
  })

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      position={[0, 200, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      zoom={INITIAL_ZOOM}
      near={0.1}
      far={500}
    />
  )
}
