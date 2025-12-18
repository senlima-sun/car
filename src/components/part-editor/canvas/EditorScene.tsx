import { Suspense, useRef, useEffect } from 'react'
import { OrbitControls, Environment } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePartEditorStore } from '../store'
import EditorGrid from './EditorGrid'
import PartsList from './PartsList'
import GizmoController from './GizmoController'
import ReferenceCarPreview from './ReferenceCarPreview'

// Keyboard camera panning with Arrow keys + Page Up/Down
function CameraKeyboardControls() {
  const { camera } = useThree()
  const keys = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    pageup: false,
    pagedown: false,
  })
  const panSpeed = 0.15

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      switch (e.key) {
        case 'ArrowUp':
          keys.current.up = true
          break
        case 'ArrowDown':
          keys.current.down = true
          break
        case 'ArrowLeft':
          keys.current.left = true
          break
        case 'ArrowRight':
          keys.current.right = true
          break
        case 'PageUp':
          keys.current.pageup = true
          break
        case 'PageDown':
          keys.current.pagedown = true
          break
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          keys.current.up = false
          break
        case 'ArrowDown':
          keys.current.down = false
          break
        case 'ArrowLeft':
          keys.current.left = false
          break
        case 'ArrowRight':
          keys.current.right = false
          break
        case 'PageUp':
          keys.current.pageup = false
          break
        case 'PageDown':
          keys.current.pagedown = false
          break
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame(() => {
    const { up, down, left, right, pageup, pagedown } = keys.current
    if (!up && !down && !left && !right && !pageup && !pagedown) return

    // Get camera right and forward vectors (projected to XZ plane)
    const rightVec = new THREE.Vector3()
    const forwardVec = new THREE.Vector3()
    camera.getWorldDirection(forwardVec)
    rightVec.crossVectors(forwardVec, camera.up).normalize()
    forwardVec.crossVectors(camera.up, rightVec).normalize()

    const move = new THREE.Vector3()
    if (up) move.add(forwardVec.clone().multiplyScalar(panSpeed))
    if (down) move.add(forwardVec.clone().multiplyScalar(-panSpeed))
    if (left) move.add(rightVec.clone().multiplyScalar(-panSpeed))
    if (right) move.add(rightVec.clone().multiplyScalar(panSpeed))
    if (pagedown) move.y -= panSpeed
    if (pageup) move.y += panSpeed

    camera.position.add(move)
  })

  return null
}

export default function EditorScene() {
  const selectPart = usePartEditorStore(s => s.selectPart)

  const handleBackgroundClick = () => {
    selectPart(null)
  }

  return (
    <Suspense fallback={null}>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} />

      {/* Environment for reflections */}
      <Environment preset='studio' />

      {/* Grid */}
      <EditorGrid />

      {/* Reference car ghost for positioning */}
      <ReferenceCarPreview />

      {/* Invisible ground plane for clicking to deselect */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        onClick={handleBackgroundClick}
        visible={false}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial />
      </mesh>

      {/* Parts */}
      <PartsList />

      {/* Transform gizmo */}
      <GizmoController />

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.1}
        minDistance={2}
        maxDistance={50}
      />
      <CameraKeyboardControls />
    </Suspense>
  )
}
