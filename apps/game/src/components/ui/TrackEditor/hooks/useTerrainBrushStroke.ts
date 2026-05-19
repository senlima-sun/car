import { useCallback, useEffect, useRef, useState } from 'react'
import { useTerrainBrushStore } from '@/stores/useTerrainBrushStore'
import { useTerrainStore } from '@/stores/useTerrainStore'
import { useTrackStore } from '@/stores/useTrackStore'
import { editorCommandStack } from '@/utils/commandStack'
import { computeBrushStroke, type BrushParams } from '@/utils/terrainBrush'
import type { EditorCommand } from '@/types/editor'

type StrokeRef = {
  active: boolean
  lastTime: number
  diff: Map<number, { before: number; after: number }>
  rafId: number | null
}

export type TerrainBrushStrokeApi = {
  isStrokeActive: boolean
  startStroke: (worldX: number, worldZ: number) => void
  continueStroke: (worldX: number, worldZ: number) => void
  commitStroke: () => void
}

export function useTerrainBrushStroke(): TerrainBrushStrokeApi {
  const [isStrokeActive, setIsStrokeActive] = useState(false)
  const strokeRef = useRef<StrokeRef>({
    active: false,
    lastTime: 0,
    diff: new Map(),
    rafId: null,
  })

  const flushVisuals = useCallback(() => {
    const stroke = strokeRef.current
    if (stroke.rafId !== null) {
      cancelAnimationFrame(stroke.rafId)
      stroke.rafId = null
    }
    useTerrainStore.getState().flushVisualVersion()
  }, [])

  const scheduleVisuals = useCallback(() => {
    if (strokeRef.current.rafId !== null) return
    strokeRef.current.rafId = requestAnimationFrame(() => {
      strokeRef.current.rafId = null
      useTerrainStore.getState().flushVisualVersion()
    })
  }, [])

  const applyBrush = useCallback(
    (worldX: number, worldZ: number, dt: number) => {
      const { terrainBrushType, terrainBrushRadius, terrainBrushStrength, terrainFlattenTarget } =
        useTerrainBrushStore.getState()
      const { heightmap, resolution, worldSize, applyBrushStroke } = useTerrainStore.getState()
      const params: BrushParams = {
        type: terrainBrushType,
        radius: terrainBrushRadius,
        strength: terrainBrushStrength,
        flattenTarget: terrainFlattenTarget,
      }
      const changes = computeBrushStroke(
        heightmap,
        resolution,
        worldSize,
        worldX,
        worldZ,
        params,
        dt,
      )
      if (changes.size === 0) return
      const diff = strokeRef.current.diff
      for (const [index, after] of changes) {
        const existing = diff.get(index)
        if (existing) existing.after = after
        else diff.set(index, { before: heightmap[index]!, after })
      }
      applyBrushStroke(changes, { deferVersion: true })
      scheduleVisuals()
    },
    [scheduleVisuals],
  )

  const startStroke = useCallback(
    (worldX: number, worldZ: number) => {
      strokeRef.current = {
        active: true,
        lastTime: performance.now(),
        diff: new Map(),
        rafId: strokeRef.current.rafId,
      }
      setIsStrokeActive(true)
      applyBrush(worldX, worldZ, 1 / 60)
    },
    [applyBrush],
  )

  const continueStroke = useCallback(
    (worldX: number, worldZ: number) => {
      if (!strokeRef.current.active) return
      const now = performance.now()
      const dt = Math.min((now - strokeRef.current.lastTime) / 1000, 0.1)
      strokeRef.current.lastTime = now
      applyBrush(worldX, worldZ, dt)
    },
    [applyBrush],
  )

  const commitStroke = useCallback(() => {
    if (!strokeRef.current.active) return
    const diff = strokeRef.current.diff
    strokeRef.current.active = false
    setIsStrokeActive(false)
    if (strokeRef.current.rafId !== null) {
      flushVisuals()
    }
    if (diff.size > 0) {
      const diffCopy = new Map(diff)
      const brushType = useTerrainBrushStore.getState().terrainBrushType
      const command: EditorCommand = {
        execute: () => {
          const changes = new Map<number, number>()
          for (const [index, { after }] of diffCopy) changes.set(index, after)
          useTerrainStore.getState().applyBrushStroke(changes)
          useTerrainStore.getState().commitPhysics()
        },
        undo: () => {
          const changes = new Map<number, number>()
          for (const [index, { before }] of diffCopy) changes.set(index, before)
          useTerrainStore.getState().applyBrushStroke(changes)
          useTerrainStore.getState().commitPhysics()
        },
        description: `Terrain ${brushType}`,
      }
      editorCommandStack.push(command)
      useTerrainStore.getState().commitPhysics()
      useTrackStore.getState().markDirty()
    }
    strokeRef.current.diff = new Map()
  }, [flushVisuals])

  useEffect(() => {
    return () => {
      if (strokeRef.current.rafId !== null) {
        cancelAnimationFrame(strokeRef.current.rafId)
      }
    }
  }, [])

  return { isStrokeActive, startStroke, continueStroke, commitStroke }
}
