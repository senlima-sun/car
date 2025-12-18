import { useRef, useEffect, useCallback } from 'react'
import { TransformControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { usePartEditorStore } from '@/stores/usePartEditorStore'

export default function GizmoController() {
  const transformRef = useRef<any>(null)
  const { scene } = useThree()

  const selectedPartId = usePartEditorStore((s) => s.selectedPartId)
  const parts = usePartEditorStore((s) => s.parts)
  const transformMode = usePartEditorStore((s) => s.transformMode)
  const snapEnabled = usePartEditorStore((s) => s.snapEnabled)
  const snapValue = usePartEditorStore((s) => s.snapValue)
  const rotationSnapValue = usePartEditorStore((s) => s.rotationSnapValue)
  const updatePart = usePartEditorStore((s) => s.updatePart)
  const pushHistory = usePartEditorStore((s) => s.pushHistory)

  const selectedPart = parts.find((p) => p.id === selectedPartId)

  const handleObjectChange = useCallback(() => {
    if (!transformRef.current || !selectedPartId) return

    const object = transformRef.current.object as THREE.Object3D
    if (!object) return

    updatePart(selectedPartId, {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: [object.scale.x, object.scale.y, object.scale.z],
    })
  }, [selectedPartId, updatePart])

  const handleDragEnd = useCallback(() => {
    pushHistory()
  }, [pushHistory])

  useEffect(() => {
    if (!transformRef.current) return

    const controls = transformRef.current
    controls.addEventListener('objectChange', handleObjectChange)
    controls.addEventListener('dragging-changed', (event: { value: boolean }) => {
      if (!event.value) {
        handleDragEnd()
      }
    })

    return () => {
      controls.removeEventListener('objectChange', handleObjectChange)
    }
  }, [handleObjectChange, handleDragEnd])

  // Find the mesh in the scene by traversing
  useEffect(() => {
    if (!transformRef.current || !selectedPartId) {
      if (transformRef.current) {
        transformRef.current.detach()
      }
      return
    }

    // Find mesh with matching userData or by traversing children
    let targetMesh: THREE.Object3D | null = null
    scene.traverse((obj) => {
      if (obj.userData.partId === selectedPartId) {
        targetMesh = obj
      }
    })

    if (targetMesh) {
      transformRef.current.attach(targetMesh)
    }
  }, [selectedPartId, scene, parts])

  if (!selectedPart) return null

  return (
    <TransformControls
      ref={transformRef}
      mode={transformMode}
      translationSnap={snapEnabled ? snapValue : null}
      rotationSnap={snapEnabled ? rotationSnapValue : null}
      scaleSnap={snapEnabled ? snapValue : null}
      size={0.75}
    />
  )
}
