import { useMemo } from 'react'
import { useCustomizationStore } from '../../../../stores/useCustomizationStore'

export interface StartTransform {
  startPosition: [number, number, number]
  startRotation: [number, number, number]
}

/**
 * Hook to calculate car starting position from checkpoint
 * Places the car 5 units behind the checkpoint, facing the direction of travel
 */
export function useStartPosition(): StartTransform {
  const placedObjects = useCustomizationStore(state => state.placedObjects)

  return useMemo(() => {
    const checkpoint = placedObjects.find(obj => obj.type === 'checkpoint')

    if (checkpoint && checkpoint.startPoint && checkpoint.endPoint) {
      // Calculate direction vector from checkpoint line
      const dx = checkpoint.endPoint[0] - checkpoint.startPoint[0]
      const dz = checkpoint.endPoint[2] - checkpoint.startPoint[2]

      // Get perpendicular vector (direction of travel)
      const perpX = -dz
      const perpZ = dx
      const len = Math.sqrt(perpX * perpX + perpZ * perpZ)

      if (len > 0) {
        const normX = perpX / len
        const normZ = perpZ / len

        // Position car 5 units behind checkpoint
        const spawnX = checkpoint.position[0] - normX * 5
        const spawnZ = checkpoint.position[2] - normZ * 5

        // Calculate rotation to face direction of travel
        const rotation = Math.atan2(normX, normZ)

        return {
          startPosition: [spawnX, 1, spawnZ] as [number, number, number],
          startRotation: [0, rotation, 0] as [number, number, number],
        }
      }
    }

    // Default starting position if no checkpoint found
    return {
      startPosition: [0, 1, 0] as [number, number, number],
      startRotation: [0, 0, 0] as [number, number, number],
    }
  }, [placedObjects])
}
