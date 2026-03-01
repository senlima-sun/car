import { useRef, useCallback, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useEditorStore } from '@/stores/useEditorStore'
import { useTerrainStore } from '@/stores/useTerrainStore'
import { computeBrushStroke, type BrushParams } from '@/utils/terrainBrush'
import { editorCommandStack } from '@/utils/commandStack'
import type { EditorCommand } from '@/types/editor'

const _raycaster = new THREE.Raycaster()
const _pointer = new THREE.Vector2()
const _plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const _intersection = new THREE.Vector3()

export default function TerrainBrushInteraction() {
  const { camera, gl } = useThree()
  const isPainting = useRef(false)
  const strokeDiff = useRef(new Map<number, { before: number; after: number }>())
  const lastBrushTime = useRef(0)

  const getWorldPos = useCallback(
    (e: PointerEvent | MouseEvent): [number, number] | null => {
      const rect = gl.domElement.getBoundingClientRect()
      _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      _raycaster.setFromCamera(_pointer, camera)
      const hit = _raycaster.ray.intersectPlane(_plane, _intersection)
      if (!hit) return null
      return [_intersection.x, _intersection.z]
    },
    [camera, gl],
  )

  const applyBrush = useCallback((worldX: number, worldZ: number, dt: number) => {
    const { terrainBrushType, terrainBrushRadius, terrainBrushStrength, terrainFlattenTarget } =
      useEditorStore.getState()
    const { heightmap, resolution, worldSize, applyBrushStroke } = useTerrainStore.getState()

    const params: BrushParams = {
      type: terrainBrushType,
      radius: terrainBrushRadius,
      strength: terrainBrushStrength,
      flattenTarget: terrainFlattenTarget,
    }

    const changes = computeBrushStroke(heightmap, resolution, worldSize, worldX, worldZ, params, dt)
    if (changes.size === 0) return

    const diff = strokeDiff.current
    for (const [index, newHeight] of changes) {
      if (!diff.has(index)) {
        diff.set(index, { before: heightmap[index], after: newHeight })
      } else {
        diff.get(index)!.after = newHeight
      }
    }

    applyBrushStroke(changes)
  }, [])

  useEffect(() => {
    const canvas = gl.domElement

    const handlePointerDown = (e: PointerEvent) => {
      if (!useEditorStore.getState().terrainEditMode) return
      if (e.button !== 0) return

      const pos = getWorldPos(e)
      if (!pos) return

      isPainting.current = true
      strokeDiff.current = new Map()
      lastBrushTime.current = performance.now()
      applyBrush(pos[0], pos[1], 1 / 60)

      canvas.setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!useEditorStore.getState().terrainEditMode) return

      const pos = getWorldPos(e)
      if (pos) {
        useEditorStore.setState({
          previewPosition: [pos[0], 0, pos[1]],
        })
      }

      if (!isPainting.current || !pos) return

      const now = performance.now()
      const dt = Math.min((now - lastBrushTime.current) / 1000, 0.1)
      lastBrushTime.current = now
      applyBrush(pos[0], pos[1], dt)
    }

    const handlePointerUp = (e: PointerEvent) => {
      if (!isPainting.current) return
      isPainting.current = false
      canvas.releasePointerCapture(e.pointerId)

      const diff = strokeDiff.current
      if (diff.size === 0) return

      const diffCopy = new Map(diff)
      const brushType = useEditorStore.getState().terrainBrushType

      const command: EditorCommand = {
        execute: () => {
          const changes = new Map<number, number>()
          for (const [index, { after }] of diffCopy) {
            changes.set(index, after)
          }
          useTerrainStore.getState().applyBrushStroke(changes)
          useTerrainStore.getState().commitPhysics()
        },
        undo: () => {
          const changes = new Map<number, number>()
          for (const [index, { before }] of diffCopy) {
            changes.set(index, before)
          }
          useTerrainStore.getState().applyBrushStroke(changes)
          useTerrainStore.getState().commitPhysics()
        },
        description: `Terrain ${brushType}`,
      }

      editorCommandStack.push(command)
      useTerrainStore.getState().commitPhysics()

      strokeDiff.current = new Map()
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
    }
  }, [gl, getWorldPos, applyBrush])

  return null
}
