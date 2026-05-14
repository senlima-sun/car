import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useVisibilityStore } from '@/stores/useVisibilityStore'
import { useCarStore } from '@/stores/useCarStore'
import { isCustomizeStatus, useGameStore } from '@/stores/useGameStore'
import { useCustomizationStore } from '@/stores/useCustomizationStore'
import { usePerformanceStore } from '@/stores/usePerformanceStore'
import { getEditorCameraState } from '@/components/canvas/Camera/EditorCamera'

const UPDATE_INTERVAL_S = 0.2

function pushVisibilityUpdate() {
  const { updateVisibility } = useVisibilityStore.getState()
  const isEditor = isCustomizeStatus(useGameStore.getState().status)
  const tier = usePerformanceStore.getState().tier
  const objects = useCustomizationStore.getState().placedObjects

  if (isEditor) {
    const cam = getEditorCameraState()
    updateVisibility(cam.targetX, cam.targetZ, 0, 0, true, cam.distance, tier, objects)
    return
  }

  const car = useCarStore.getState()
  const [qx, qy, qz, qw] = car.rotation
  const heading = Math.atan2(2 * (qw * qy - qx * qz), 1 - 2 * (qy * qy + qz * qz))
  updateVisibility(car.position[0], car.position[2], heading, car.speed, false, 0, tier, objects)
}

export default function VisibilityUpdater() {
  const elapsedRef = useRef(0)

  useEffect(() => {
    const initial = useCustomizationStore.getState().placedObjects
    if (initial.length > 0) {
      useVisibilityStore.getState().rebuildGrid(initial)
      pushVisibilityUpdate()
    }

    return useCustomizationStore.subscribe((state, prev) => {
      if (state.placedObjects === prev.placedObjects) return
      useVisibilityStore.getState().rebuildGrid(state.placedObjects)
      pushVisibilityUpdate()
    })
  }, [])

  useFrame((_, delta) => {
    elapsedRef.current += delta
    if (elapsedRef.current < UPDATE_INTERVAL_S) return
    elapsedRef.current = 0
    pushVisibilityUpdate()
  })

  return null
}
