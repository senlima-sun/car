import { useRef, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { useEditorStore } from '@/stores/useEditorStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'

const INITIAL_DISTANCE = 150
const MIN_DISTANCE = 10
const MAX_DISTANCE = 500
const INITIAL_ELEVATION = (80 * Math.PI) / 180
const MIN_ELEVATION = (10 * Math.PI) / 180
const MAX_ELEVATION = (89 * Math.PI) / 180
const ROTATE_SPEED = 0.005
const PAN_SPEED = 0.002
const KEYBOARD_PAN_SPEED = 1.5
const ZOOM_SPEED = 0.1
const LERP_FACTOR = 0.15

interface OrbitState {
  azimuth: number
  elevation: number
  distance: number
  targetX: number
  targetZ: number
}

const ELEVATION_PRESETS: Record<string, number> = {
  Digit1: (85 * Math.PI) / 180,
  Digit2: (45 * Math.PI) / 180,
  Digit3: (20 * Math.PI) / 180,
}

let editorCameraState = { targetX: 0, targetZ: 0, distance: INITIAL_DISTANCE }

export function getEditorCameraState() {
  return editorCameraState
}

export default function EditorCamera() {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  const { gl } = useThree()

  const orbit = useRef<OrbitState>({
    azimuth: 0,
    elevation: INITIAL_ELEVATION,
    distance: INITIAL_DISTANCE,
    targetX: 0,
    targetZ: 0,
  })

  const targetOrbit = useRef<OrbitState>({
    azimuth: 0,
    elevation: INITIAL_ELEVATION,
    distance: INITIAL_DISTANCE,
    targetX: 0,
    targetZ: 0,
  })

  const dragState = useRef({
    isRotating: false,
    isPanning: false,
    lastX: 0,
    lastY: 0,
  })

  const keysRef = useRef<Record<string, boolean>>({})

  const cameraTarget = useEditorStore(s => s.cameraTarget)

  useEffect(() => {
    if (cameraTarget) {
      targetOrbit.current.targetX = cameraTarget[0]
      targetOrbit.current.targetZ = cameraTarget[2]
    }
  }, [cameraTarget])

  useEffect(() => {
    const objects = useCustomizationStore.getState().placedObjects
    if (objects.length === 0) return

    const checkpoints = objects.filter(o => o.type === 'checkpoint')
    const roads = objects.filter(o => o.type === 'road')

    let points: [number, number, number][] = []

    if (checkpoints.length > 0) {
      for (const cp of checkpoints) {
        if (cp.startPoint) points.push(cp.startPoint)
        if (cp.endPoint) points.push(cp.endPoint)
        if (points.length === 0) points.push(cp.position)
      }
    } else if (roads.length > 0) {
      for (const r of roads) {
        if (r.startPoint) points.push(r.startPoint)
        if (r.endPoint) points.push(r.endPoint)
      }
    } else {
      points = objects.map(o => o.position)
    }

    if (points.length === 0) return

    let cx = 0, cz = 0
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const p of points) {
      cx += p[0]
      cz += p[2]
      minX = Math.min(minX, p[0])
      maxX = Math.max(maxX, p[0])
      minZ = Math.min(minZ, p[2])
      maxZ = Math.max(maxZ, p[2])
    }
    cx /= points.length
    cz /= points.length

    const dx = maxX - minX
    const dz = maxZ - minZ
    const diagonal = Math.sqrt(dx * dx + dz * dz)
    const distance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, diagonal * 0.8 + 30))

    orbit.current.targetX = cx
    orbit.current.targetZ = cz
    orbit.current.distance = distance
    targetOrbit.current.targetX = cx
    targetOrbit.current.targetZ = cz
    targetOrbit.current.distance = distance
  }, [])

  const handleContextMenu = useCallback((e: Event) => {
    e.preventDefault()
  }, [])

  useEffect(() => {
    const canvas = gl.domElement

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        dragState.current.isRotating = true
        dragState.current.lastX = e.clientX
        dragState.current.lastY = e.clientY
      } else if (e.button === 1) {
        e.preventDefault()
        dragState.current.isPanning = true
        dragState.current.lastX = e.clientX
        dragState.current.lastY = e.clientY
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) dragState.current.isRotating = false
      if (e.button === 1) dragState.current.isPanning = false
    }

    const handleMouseLeave = () => {
      dragState.current.isRotating = false
      dragState.current.isPanning = false
    }

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragState.current.lastX
      const deltaY = e.clientY - dragState.current.lastY
      dragState.current.lastX = e.clientX
      dragState.current.lastY = e.clientY

      if (dragState.current.isRotating) {
        targetOrbit.current.azimuth -= deltaX * ROTATE_SPEED
        targetOrbit.current.elevation = Math.max(
          MIN_ELEVATION,
          Math.min(MAX_ELEVATION, targetOrbit.current.elevation + deltaY * ROTATE_SPEED),
        )
      }

      if (dragState.current.isPanning) {
        const { azimuth, distance } = targetOrbit.current
        const panScale = distance * PAN_SPEED

        const rightX = Math.cos(azimuth)
        const rightZ = -Math.sin(azimuth)
        const forwardX = Math.sin(azimuth)
        const forwardZ = Math.cos(azimuth)

        targetOrbit.current.targetX -= (deltaX * rightX + deltaY * forwardX) * panScale
        targetOrbit.current.targetZ -= (deltaX * rightZ + deltaY * forwardZ) * panScale
      }
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 1 : -1
      const zoomAmount = delta * ZOOM_SPEED * targetOrbit.current.distance
      targetOrbit.current.distance = Math.max(
        MIN_DISTANCE,
        Math.min(MAX_DISTANCE, targetOrbit.current.distance + zoomAmount),
      )
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('contextmenu', handleContextMenu)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [gl, handleContextMenu])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true

      if (e.code === 'KeyQ') {
        targetOrbit.current.azimuth += Math.PI / 4
      }
      if (e.code === 'KeyE') {
        targetOrbit.current.azimuth -= Math.PI / 4
      }

      const preset = ELEVATION_PRESETS[e.code]
      if (preset !== undefined) {
        targetOrbit.current.elevation = preset
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
  }, [])

  useFrame((_, delta) => {
    if (!cameraRef.current) return

    const keys = keysRef.current
    const { azimuth, distance } = targetOrbit.current
    const panFactor = distance * KEYBOARD_PAN_SPEED * delta

    const forwardX = Math.sin(azimuth)
    const forwardZ = Math.cos(azimuth)
    const rightX = Math.cos(azimuth)
    const rightZ = -Math.sin(azimuth)

    if (keys['KeyW'] || keys['ArrowUp']) {
      targetOrbit.current.targetX -= forwardX * panFactor
      targetOrbit.current.targetZ -= forwardZ * panFactor
    }
    if (keys['KeyS'] || keys['ArrowDown']) {
      targetOrbit.current.targetX += forwardX * panFactor
      targetOrbit.current.targetZ += forwardZ * panFactor
    }
    if (keys['KeyA'] || keys['ArrowLeft']) {
      targetOrbit.current.targetX -= rightX * panFactor
      targetOrbit.current.targetZ -= rightZ * panFactor
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
      targetOrbit.current.targetX += rightX * panFactor
      targetOrbit.current.targetZ += rightZ * panFactor
    }

    const t = targetOrbit.current
    const o = orbit.current
    o.azimuth += (t.azimuth - o.azimuth) * LERP_FACTOR
    o.elevation += (t.elevation - o.elevation) * LERP_FACTOR
    o.distance += (t.distance - o.distance) * LERP_FACTOR
    o.targetX += (t.targetX - o.targetX) * LERP_FACTOR
    o.targetZ += (t.targetZ - o.targetZ) * LERP_FACTOR

    const camX = o.targetX + Math.sin(o.azimuth) * Math.cos(o.elevation) * o.distance
    const camY = Math.sin(o.elevation) * o.distance
    const camZ = o.targetZ + Math.cos(o.azimuth) * Math.cos(o.elevation) * o.distance

    cameraRef.current.near = Math.max(1, o.distance * 0.01)
    cameraRef.current.updateProjectionMatrix()
    cameraRef.current.position.set(camX, camY, camZ)
    cameraRef.current.lookAt(o.targetX, 0, o.targetZ)

    editorCameraState = { targetX: o.targetX, targetZ: o.targetZ, distance: o.distance }
  })

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={[0, INITIAL_DISTANCE * Math.sin(INITIAL_ELEVATION), 0]}
      fov={50}
      near={0.1}
      far={2000}
    />
  )
}
