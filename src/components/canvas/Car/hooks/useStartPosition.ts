import { useMemo } from 'react'
import { useCustomizationStore } from '../../../../stores/useCustomizationStore'

export interface StartTransform {
  startPosition: [number, number, number]
  startRotation: [number, number, number]
}

function perpendicularDirection(
  obj: { startPoint: [number, number, number]; endPoint: [number, number, number] },
): [number, number] | null {
  const dx = obj.endPoint[0] - obj.startPoint[0]
  const dz = obj.endPoint[2] - obj.startPoint[2]
  const perpX = -dz
  const perpZ = dx
  const len = Math.sqrt(perpX * perpX + perpZ * perpZ)
  if (len === 0) return null
  return [perpX / len, perpZ / len]
}

function spawnBehind(
  pos: [number, number, number],
  dirX: number,
  dirZ: number,
  elevation: number,
): StartTransform {
  return {
    startPosition: [pos[0] - dirX * 5, elevation + 1, pos[2] - dirZ * 5],
    startRotation: [0, Math.atan2(dirX, dirZ), 0],
  }
}

const DEFAULT_TRANSFORM: StartTransform = {
  startPosition: [0, 1, 0],
  startRotation: [0, 0, 0],
}

export function useStartPosition(): StartTransform {
  const placedObjects = useCustomizationStore(state => state.placedObjects)

  return useMemo(() => {
    const startFinish = placedObjects.find(
      obj => obj.type === 'checkpoint' && obj.checkpointType !== 'sector',
    )

    const sectors = placedObjects
      .filter(obj => obj.type === 'checkpoint' && obj.checkpointType === 'sector')
      .sort((a, b) => (a.checkpointOrder ?? Infinity) - (b.checkpointOrder ?? Infinity))

    if (startFinish?.startPoint && startFinish?.endPoint) {
      const elev = ((startFinish.startPoint[1] ?? 0) + (startFinish.endPoint[1] ?? 0)) / 2

      if (sectors.length > 0) {
        const target = sectors[0]
        const dx = target.position[0] - startFinish.position[0]
        const dz = target.position[2] - startFinish.position[2]
        const len = Math.sqrt(dx * dx + dz * dz)
        if (len > 0) {
          return spawnBehind(startFinish.position, dx / len, dz / len, elev)
        }
      }

      const perp = perpendicularDirection(startFinish as { startPoint: [number, number, number]; endPoint: [number, number, number] })
      if (perp) {
        return spawnBehind(startFinish.position, perp[0], perp[1], elev)
      }
    }

    if (sectors.length > 0 && sectors[0].startPoint && sectors[0].endPoint) {
      const s = sectors[0]
      const elev = ((s.startPoint![1] ?? 0) + (s.endPoint![1] ?? 0)) / 2
      const perp = perpendicularDirection(s as { startPoint: [number, number, number]; endPoint: [number, number, number] })
      if (perp) {
        return spawnBehind(s.position, perp[0], perp[1], elev)
      }
    }

    const road = placedObjects.find(
      obj => obj.type === 'road' && obj.startPoint && obj.endPoint,
    )
    if (road?.startPoint && road?.endPoint) {
      const elev = ((road.startPoint[1] ?? 0) + (road.endPoint[1] ?? 0)) / 2
      const perp = perpendicularDirection(road as { startPoint: [number, number, number]; endPoint: [number, number, number] })
      if (perp) {
        return spawnBehind(road.position, perp[0], perp[1], elev)
      }
    }

    return DEFAULT_TRANSFORM
  }, [placedObjects])
}
