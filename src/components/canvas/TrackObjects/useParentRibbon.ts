import { useMemo } from 'react'
import type { PlacedObject } from '@/types/trackObjects'

export function useParentRibbon(
  parentId: string | undefined,
  allObjects: readonly PlacedObject[],
): PlacedObject | undefined {
  return useMemo(() => {
    if (!parentId) return undefined
    return allObjects.find(o => o.id === parentId)
  }, [parentId, allObjects])
}
