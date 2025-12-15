import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
import { Vector3 } from 'three'
import type { OrthographicCamera as OrthographicCameraType } from 'three'

const ISO_ELEVATION = Math.PI / 2 // 90 degrees - true top-down view
const ISO_AZIMUTH = 0 // No horizontal rotation for top-down
const PAN_SPEED = 80
const MIN_ZOOM = 15
const MAX_ZOOM = 150
const INITIAL_ZOOM = 50
const CAMERA_DISTANCE = 200

export default function IsometricCamera() {
  const cameraRef = useRef<OrthographicCameraType>(null)
  const { gl } = useThree()

  // Camera target position (what we're looking at on the ground)
  const targetPos = useRef(new Vector3(0, 0, 0))
  const zoomLevel = useRef(INITIAL_ZOOM)

  // Track pressed keys
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
  })

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = true
          break
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = true
          break
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = true
          break
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = true
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = false
          break
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = false
          break
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = false
          break
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = false
          break
      }
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomLevel.current = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, zoomLevel.current + e.deltaY * 0.05),
      )
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    gl.domElement.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      gl.domElement.removeEventListener('wheel', handleWheel)
    }
  }, [gl])

  useFrame((_, delta) => {
    if (!cameraRef.current) return

    const camera = cameraRef.current

    // Calculate pan direction in world space (direct mapping for top-down view)
    // W/S = Z axis (up/down on screen), A/D = X axis (left/right on screen)
    const panX = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0)
    const panZ = (keys.current.backward ? 1 : 0) - (keys.current.forward ? 1 : 0)

    // Direct world space movement (no rotation needed for top-down view)
    const worldPanX = panX * PAN_SPEED * delta
    const worldPanZ = panZ * PAN_SPEED * delta

    targetPos.current.x += worldPanX
    targetPos.current.z += worldPanZ

    // Calculate camera position based on isometric angles
    const camOffset = new Vector3(
      Math.sin(ISO_AZIMUTH) * Math.cos(ISO_ELEVATION) * CAMERA_DISTANCE,
      Math.sin(ISO_ELEVATION) * CAMERA_DISTANCE,
      Math.cos(ISO_AZIMUTH) * Math.cos(ISO_ELEVATION) * CAMERA_DISTANCE,
    )

    camera.position.copy(targetPos.current).add(camOffset)
    camera.lookAt(targetPos.current)

    // Update orthographic zoom
    camera.zoom = 1000 / zoomLevel.current
    camera.updateProjectionMatrix()
  })

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      position={[CAMERA_DISTANCE, CAMERA_DISTANCE, CAMERA_DISTANCE]}
      zoom={1000 / INITIAL_ZOOM}
      near={0.1}
      far={2000}
    />
  )
}
