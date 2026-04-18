import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useVisibilityStore } from '../stores/useVisibilityStore'
import { useCarStore } from '../stores/useCarStore'
import { isCustomizeStatus, useGameStore } from '../stores/useGameStore'
import { useCustomizationStore } from '../stores/useCustomizationStore'
import { usePerformanceStore } from '../stores/usePerformanceStore'
import { getEditorCameraState } from '../components/canvas/Camera/EditorCamera'

const UPDATE_INTERVAL = 0.2

function runVisibilityUpdate() {
  const { updateVisibility } = useVisibilityStore.getState()
  const status = useGameStore.getState().status
  const isEditor = isCustomizeStatus(status)
  const tier = usePerformanceStore.getState().tier
  const objects = useCustomizationStore.getState().placedObjects

  if (isEditor) {
    const cam = getEditorCameraState()
    updateVisibility(cam.targetX, cam.targetZ, 0, 0, true, cam.distance, tier, objects)
  } else {
    const car = useCarStore.getState()
    const [qx, qy, qz, qw] = car.rotation
    const heading = Math.atan2(2 * (qw * qy - qx * qz), 1 - 2 * (qy * qy + qz * qz))
    updateVisibility(car.position[0], car.position[2], heading, car.speed, false, 0, tier, objects)
  }
}

export function useVisibilityUpdater() {
  const timerRef = useRef(0)
  const prevObjectsRef = useRef<unknown>(null)

  useEffect(() => {
    const unsub = useCustomizationStore.subscribe(state => {
      if (state.placedObjects !== prevObjectsRef.current) {
        prevObjectsRef.current = state.placedObjects
        useVisibilityStore.getState().rebuildGrid(state.placedObjects)
        runVisibilityUpdate()
      }
    })

    const objects = useCustomizationStore.getState().placedObjects
    if (objects.length > 0) {
      prevObjectsRef.current = objects
      useVisibilityStore.getState().rebuildGrid(objects)
      runVisibilityUpdate()
    }

    return unsub
  }, [])

  useFrame(() => {
    timerRef.current += 1 / 120
    if (timerRef.current < UPDATE_INTERVAL) return
    timerRef.current = 0
    runVisibilityUpdate()
  })
}
