import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTrackEditorStore, sameAnchorRef } from './state/useTrackEditorStore'
import type { Point } from './geometry/types'
import { getAnchor, resolveAnchor } from './geometry/path'
import { dist } from './geometry/point'
import { screenToWorld, worldToScreen, zoomAt } from './geometry/viewport'
import { screenPointOf } from './hooks/usePointerWorld'
import { closestPointOnAnyPath, closestPointOnPath } from './geometry/closestPoint'
import {
  CLOSE_RADIUS_SCREEN,
  DRAG_THRESHOLD_SCREEN,
  HIT_RADIUS_SCREEN,
  PATH_HIT_RADIUS_SCREEN,
  edgeSideAt,
  hitTestAnchor,
  hitTestCurb,
  hitTestHandle,
  hitTestPitArea,
  pitAreaRotateHandleWorld,
} from './geometry/hitTest'
import { useTerrainBrushStore } from '@/stores/useTerrainBrushStore'
import { useTerrainStore } from '@/stores/useTerrainStore'
import { computeBrushStroke, type BrushParams } from '@/utils/terrainBrush'
import { editorCommandStack } from '@/utils/commandStack'
import type { EditorCommand } from '@/types/editor'
import HeightmapOverlay from './layers/HeightmapOverlay'
import TerrainBrushCursor from './layers/TerrainBrushCursor'
import PenCanvasGrid from './layers/PenCanvasGrid'
import PenCanvasPaths from './layers/PenCanvasPaths'
import PenCanvasAnchors from './layers/PenCanvasAnchors'
import CurbsLayer from './layers/CurbsLayer'
import CheckpointsLayer from './layers/CheckpointsLayer'
import FlowArrowsLayer from './layers/FlowArrowsLayer'
import PitBoxAreaLayer from './layers/PitBoxAreaLayer'

import type { Drag } from './hooks/types'

export default function PenCanvas() {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const [hoverWorld, setHoverWorld] = useState<Point | null>(null)
  const [penPathInsertHint, setPenPathInsertHint] = useState<Point | null>(null)
  const [curbHoverHint, setCurbHoverHint] = useState<{
    pathId: string
    pathPos: number
    edge: 'left' | 'right'
  } | null>(null)
  const [drag, setDrag] = useState<Drag>(null)
  const [terrainStrokeActive, setTerrainStrokeActive] = useState(false)
  const terrainStroke = useRef<{
    active: boolean
    lastTime: number
    diff: Map<number, { before: number; after: number }>
    rafId: number | null
  }>({ active: false, lastTime: 0, diff: new Map(), rafId: null })

  const { doc, viewport, tool, pen, pendingCurbVariant } = useTrackEditorStore(
    useShallow(s => ({
      doc: s.doc,
      viewport: s.viewport,
      tool: s.tool,
      pen: s.pen,
      pendingCurbVariant: s.pendingCurbVariant,
    })),
  )

  const flushTerrainBrushVisuals = useCallback(() => {
    const stroke = terrainStroke.current
    if (stroke.rafId !== null) {
      cancelAnimationFrame(stroke.rafId)
      stroke.rafId = null
    }
    useTerrainStore.getState().flushVisualVersion()
  }, [])

  const scheduleTerrainBrushVisuals = useCallback(() => {
    if (terrainStroke.current.rafId !== null) return
    terrainStroke.current.rafId = requestAnimationFrame(() => {
      terrainStroke.current.rafId = null
      useTerrainStore.getState().flushVisualVersion()
    })
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.code === 'Space') {
        if (!spaceDown) setSpaceDown(true)
        e.preventDefault()
      } else if (e.key === 'Escape') {
        useTrackEditorStore.getState().cancelActivePath()
      } else if (e.key === 'Enter') {
        useTrackEditorStore.getState().finishActivePath()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [spaceDown])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const handler = (e: WheelEvent) => e.preventDefault()
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  useEffect(() => {
    const pressed = new Set<string>()
    let rafId: number | null = null
    let lastTime = 0

    const isPanKey = (key: string): boolean =>
      key === 'w' ||
      key === 'a' ||
      key === 's' ||
      key === 'd' ||
      key === 'W' ||
      key === 'A' ||
      key === 'S' ||
      key === 'D'

    const step = (now: number) => {
      if (pressed.size === 0) {
        rafId = null
        lastTime = 0
        return
      }
      const dt = lastTime === 0 ? 16 : Math.min(48, now - lastTime)
      lastTime = now
      const speed = 900 * (dt / 1000)
      let dx = 0
      let dy = 0
      if (pressed.has('a')) dx += speed
      if (pressed.has('d')) dx -= speed
      if (pressed.has('w')) dy += speed
      if (pressed.has('s')) dy -= speed
      if (dx !== 0 || dy !== 0) {
        useTrackEditorStore.getState().setViewport(v => ({
          ...v,
          pan: { x: v.pan.x + dx, y: v.pan.y + dy },
        }))
      }
      rafId = requestAnimationFrame(step)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (!isPanKey(e.key)) return
      const key = e.key.toLowerCase()
      if (!pressed.has(key)) pressed.add(key)
      if (rafId === null) rafId = requestAnimationFrame(step)
      e.preventDefault()
    }

    const onKeyUp = (e: KeyboardEvent) => {
      if (!isPanKey(e.key)) return
      pressed.delete(e.key.toLowerCase())
    }

    const onBlur = () => pressed.clear()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      if (rafId !== null) cancelAnimationFrame(rafId)
    }
  }, [])

  const worldOf = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const s = screenPointOf(e, svgRef.current)
      return screenToWorld(viewport, s)
    },
    [viewport],
  )

  const applyTerrainBrush = useCallback(
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
      const diff = terrainStroke.current.diff
      for (const [index, after] of changes) {
        const existing = diff.get(index)
        if (existing) existing.after = after
        else diff.set(index, { before: heightmap[index]!, after })
      }
      applyBrushStroke(changes, { deferVersion: true })
      scheduleTerrainBrushVisuals()
    },
    [scheduleTerrainBrushVisuals],
  )

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const screen = screenPointOf(e, svgRef.current)
    const store = useTrackEditorStore.getState()

    if (spaceDown || e.button === 1) {
      setDrag({ kind: 'pan', startScreen: screen, startPan: { ...viewport.pan } })
      return
    }

    if (tool === 'terrain') {
      const world = worldOf(e)
      terrainStroke.current = {
        active: true,
        lastTime: performance.now(),
        diff: new Map(),
        rafId: terrainStroke.current.rafId,
      }
      setTerrainStrokeActive(true)
      applyTerrainBrush(world.x, world.y, 1 / 60)
      return
    }

    if (tool === 'start-finish' || tool === 'sector') {
      const world = worldOf(e)
      const hit = closestPointOnAnyPath(doc.paths, world, doc.paths)
      if (!hit) return
      const pathScreen = worldToScreen(viewport, hit.point)
      if (dist(pathScreen, screen) > 30) return
      store.addCheckpoint(tool, hit.pathId, hit.segmentIndex, hit.t)
      return
    }

    if (tool === 'pit-area') {
      const world = worldOf(e)
      store.addPitBoxArea(world)
      return
    }

    if (tool === 'curb') {
      const world = worldOf(e)
      const hit = closestPointOnAnyPath(doc.paths, world, doc.paths)
      if (!hit) return
      const pathScreen = worldToScreen(viewport, hit.point)
      if (dist(pathScreen, screen) > 40) return
      const edge = edgeSideAt(hit, world)
      const pathPos = hit.segmentIndex + hit.t
      setDrag({
        kind: 'curb',
        pathId: hit.pathId,
        edge,
        pathStart: pathPos,
        pathEnd: pathPos,
      })
      return
    }

    if (tool === 'pen') {
      const world = worldOf(e)
      const activeId = pen.activePathId
      if (activeId) {
        const path = doc.paths.find(p => p.id === activeId)
        if (path && path.anchors.length > 0) {
          const firstAnchor = resolveAnchor(doc.paths, path.anchors[0]!)
          if (firstAnchor) {
            const firstScreen = worldToScreen(viewport, firstAnchor.point)
            if (path.anchors.length >= 2 && dist(firstScreen, screen) <= CLOSE_RADIUS_SCREEN) {
              store.closeActivePath()
              return
            }
          }
        }

        const anchorHit = hitTestAnchor(doc.paths, viewport, screen)
        if (anchorHit) {
          const isSamePath = anchorHit.pathId === activeId
          const isCurrentTail = anchorHit.anchorIndex === (path?.anchors.length ?? 1) - 1
          const isFirstAnchor = anchorHit.anchorIndex === 0
          if (!isSamePath || (!isFirstAnchor && !isCurrentTail)) {
            store.appendAnchorRef(activeId, anchorHit)
            return
          }
          if (isCurrentTail) return
        }

        const otherPaths = doc.paths.filter(p => p.id !== activeId)
        const pathHit = closestPointOnAnyPath(otherPaths, world, doc.paths)
        if (pathHit) {
          const hitScreen = worldToScreen(viewport, pathHit.point)
          if (dist(hitScreen, screen) <= PATH_HIT_RADIUS_SCREEN) {
            const insertedIndex = store.insertAnchorAt(
              pathHit.pathId,
              pathHit.segmentIndex,
              pathHit.t,
            )
            store.appendAnchorRef(activeId, {
              pathId: pathHit.pathId,
              anchorIndex: insertedIndex,
            })
            return
          }
        }

        const idx = store.appendAnchor(activeId, world)
        setDrag({
          kind: 'pen-handle',
          pathId: activeId,
          anchorIndex: idx,
          startScreen: screen,
        })
        return
      }

      const anchorHit = hitTestAnchor(doc.paths, viewport, screen)
      if (pen.startRef) {
        if (sameAnchorRef(anchorHit, pen.startRef)) return
        if (anchorHit) {
          if (!getAnchor(doc.paths, pen.startRef.pathId, pen.startRef.anchorIndex)) return
          const newPathId = store.beginPathWithRef(pen.startRef)
          store.appendAnchorRef(newPathId, anchorHit)
          return
        }

        const pathHit = closestPointOnAnyPath(doc.paths, world, doc.paths)
        if (pathHit) {
          const hitScreen = worldToScreen(viewport, pathHit.point)
          if (dist(hitScreen, screen) <= PATH_HIT_RADIUS_SCREEN) {
            const insertedIndex = store.insertAnchorAt(
              pathHit.pathId,
              pathHit.segmentIndex,
              pathHit.t,
            )
            if (insertedIndex >= 0) {
              store.setPenStartRef({
                pathId: pathHit.pathId,
                anchorIndex: insertedIndex,
              })
            }
            return
          }
        }

        if (!getAnchor(doc.paths, pen.startRef.pathId, pen.startRef.anchorIndex)) return
        const newPathId = store.beginPathWithRef(pen.startRef)
        const idx = store.appendAnchor(newPathId, world)
        setDrag({
          kind: 'pen-handle',
          pathId: newPathId,
          anchorIndex: idx,
          startScreen: screen,
        })
        return
      }

      if (anchorHit) {
        store.beginPathWithRef(anchorHit)
        return
      }

      const pathHit = closestPointOnAnyPath(doc.paths, world, doc.paths)
      if (pathHit) {
        const hitScreen = worldToScreen(viewport, pathHit.point)
        if (dist(hitScreen, screen) <= PATH_HIT_RADIUS_SCREEN) {
          const insertedIndex = store.insertAnchorAt(
            pathHit.pathId,
            pathHit.segmentIndex,
            pathHit.t,
          )
          store.beginPathWithRef({
            pathId: pathHit.pathId,
            anchorIndex: insertedIndex,
          })
          return
        }
      }

      const newPathId = store.beginPath(world)
      setDrag({
        kind: 'pen-handle',
        pathId: newPathId,
        anchorIndex: 0,
        startScreen: screen,
      })
      return
    }

    if (tool === 'select') {
      const world = worldOf(e)
      const curbHit = hitTestCurb(doc.paths, viewport, store.curbs, screen)
      if (curbHit) {
        store.setSelectedCurbId(curbHit)
        store.setSelected(null)
        store.setSelectedPathId(null)
        store.setSelectedPitBoxAreaId(null)
        return
      }
      if (store.selectedCurbId) store.setSelectedCurbId(null)
      const selectedPitBoxAreaId = store.selectedPitBoxAreaId
      if (selectedPitBoxAreaId) {
        const area = store.pitBoxAreas.find(a => a.id === selectedPitBoxAreaId)
        if (area) {
          const handleWorld = pitAreaRotateHandleWorld(area)
          const handleScreen = worldToScreen(viewport, handleWorld)
          if (dist(handleScreen, screen) <= HIT_RADIUS_SCREEN) {
            store.commit()
            setDrag({
              kind: 'pit-area-rotate',
              id: area.id,
              originRotation: area.rotation,
              originPosition: { ...area.position },
            })
            return
          }
        }
      }

      const areaHit = hitTestPitArea(store.pitBoxAreas, world)
      if (areaHit) {
        const area = store.pitBoxAreas.find(a => a.id === areaHit)!
        store.setSelectedPitBoxAreaId(areaHit)
        store.commit()
        setDrag({
          kind: 'pit-area-move',
          id: areaHit,
          startWorld: world,
          origin: { ...area.position },
          startScreen: screen,
          moved: false,
        })
        return
      }

      const handleHit = hitTestHandle(doc.paths, viewport, store.selected, screen)
      if (handleHit) {
        setDrag({ kind: 'handle', ref: handleHit, startScreen: screen, moved: false })
        return
      }
      const anchorHit = hitTestAnchor(doc.paths, viewport, screen, store.selectedPathId)
      if (anchorHit) {
        if (e.altKey) {
          store.commit()
          store.toggleAnchorType(anchorHit)
          store.setSelected(anchorHit)
          return
        }
        if (e.shiftKey) {
          store.toggleAnchorInSelection(anchorHit)
          return
        }
        store.setSelected(anchorHit)
        const anchor = getAnchor(doc.paths, anchorHit.pathId, anchorHit.anchorIndex)
        if (!anchor) return
        setDrag({
          kind: 'anchor',
          ref: anchorHit,
          startWorld: worldOf(e),
          anchorOrigin: { ...anchor.point },
          startScreen: screen,
          moved: false,
        })
        return
      }

      const pathHit = closestPointOnAnyPath(doc.paths, world, doc.paths)
      if (pathHit) {
        const hitScreen = worldToScreen(viewport, pathHit.point)
        if (dist(hitScreen, screen) <= PATH_HIT_RADIUS_SCREEN) {
          store.setSelected(null)
          store.setSelectedPathId(pathHit.pathId)
          store.setSelectedPitBoxAreaId(null)
          return
        }
      }

      if (!e.shiftKey) {
        store.setSelected(null)
        store.setSelectedPathId(null)
        store.setSelectedPitBoxAreaId(null)
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const screen = screenPointOf(e, svgRef.current)
    const world = worldOf(e)

    if (tool === 'terrain') {
      setHoverWorld(world)
      if (terrainStroke.current.active) {
        const now = performance.now()
        const dt = Math.min((now - terrainStroke.current.lastTime) / 1000, 0.1)
        terrainStroke.current.lastTime = now
        applyTerrainBrush(world.x, world.y, dt)
      }
      return
    }

    if (!drag) {
      setHoverWorld(world)
      const store = useTrackEditorStore.getState()
      if (tool === 'pen' && pen.activePathId) {
        const path = doc.paths.find(p => p.id === pen.activePathId)
        if (path && path.anchors.length >= 2) {
          const first = resolveAnchor(doc.paths, path.anchors[0]!)
          if (first) {
            const firstScreen = worldToScreen(viewport, first.point)
            store.setHoverClose(dist(firstScreen, screen) <= CLOSE_RADIUS_SCREEN)
          } else {
            store.setHoverClose(false)
          }
        } else {
          store.setHoverClose(false)
        }
      }
      if (tool === 'pen') {
        const activeId = pen.activePathId
        const anchorHit = hitTestAnchor(doc.paths, viewport, screen)
        const excludeActiveFirstHit =
          anchorHit && activeId === anchorHit.pathId && anchorHit.anchorIndex === 0
        if (anchorHit && !excludeActiveFirstHit) {
          setPenPathInsertHint(null)
        } else {
          const searchPaths = activeId ? doc.paths.filter(p => p.id !== activeId) : doc.paths
          const pathHit = closestPointOnAnyPath(searchPaths, world, doc.paths)
          if (pathHit) {
            const hitScreen = worldToScreen(viewport, pathHit.point)
            if (dist(hitScreen, screen) <= PATH_HIT_RADIUS_SCREEN) {
              setPenPathInsertHint(pathHit.point)
            } else {
              setPenPathInsertHint(null)
            }
          } else {
            setPenPathInsertHint(null)
          }
        }
      } else {
        setPenPathInsertHint(null)
      }
      if (tool === 'curb') {
        const hit = closestPointOnAnyPath(doc.paths, world, doc.paths)
        if (hit) {
          const hitScreen = worldToScreen(viewport, hit.point)
          if (dist(hitScreen, screen) <= 40) {
            setCurbHoverHint({
              pathId: hit.pathId,
              pathPos: hit.segmentIndex + hit.t,
              edge: edgeSideAt(hit, world),
            })
          } else {
            setCurbHoverHint(null)
          }
        } else {
          setCurbHoverHint(null)
        }
      } else if (curbHoverHint) {
        setCurbHoverHint(null)
      }
      return
    }

    const store = useTrackEditorStore.getState()

    if (drag.kind === 'pan') {
      const dx = screen.x - drag.startScreen.x
      const dy = screen.y - drag.startScreen.y
      store.setViewport(v => ({
        ...v,
        pan: { x: drag.startPan.x + dx, y: drag.startPan.y + dy },
      }))
      return
    }

    if (drag.kind === 'pen-handle') {
      const distMoved = dist(screen, drag.startScreen)
      if (distMoved < DRAG_THRESHOLD_SCREEN) return
      const path = doc.paths.find(p => p.id === drag.pathId)
      if (!path) return
      const anchor = path.anchors[drag.anchorIndex]
      if (!anchor) return
      store.updateAnchorHandles(drag.pathId, drag.anchorIndex, world, true)
      return
    }

    if (drag.kind === 'handle') {
      const moved = drag.moved || dist(screen, drag.startScreen) > DRAG_THRESHOLD_SCREEN
      if (!drag.moved && moved) {
        store.commit()
        setDrag({ ...drag, moved: true })
      }
      store.setHandle(drag.ref, world, { breakSymmetry: e.altKey })
      return
    }

    if (drag.kind === 'anchor') {
      const moved = drag.moved || dist(screen, drag.startScreen) > DRAG_THRESHOLD_SCREEN
      if (!drag.moved && moved) {
        store.commit()
        setDrag({ ...drag, moved: true })
      }
      const dx = world.x - drag.startWorld.x
      const dy = world.y - drag.startWorld.y
      store.setAnchorPoint(
        drag.ref,
        { x: drag.anchorOrigin.x + dx, y: drag.anchorOrigin.y + dy },
        true,
      )
      return
    }

    if (drag.kind === 'pit-area-move') {
      const dx = world.x - drag.startWorld.x
      const dy = world.y - drag.startWorld.y
      store.updatePitBoxArea(drag.id, {
        position: { x: drag.origin.x + dx, y: drag.origin.y + dy },
      })
      return
    }

    if (drag.kind === 'pit-area-rotate') {
      const dx = world.x - drag.originPosition.x
      const dy = world.y - drag.originPosition.y
      const rotation = Math.atan2(dx, -dy)
      store.updatePitBoxArea(drag.id, { rotation })
      return
    }

    if (drag.kind === 'curb') {
      const path = doc.paths.find(p => p.id === drag.pathId)
      if (!path) return
      const hit = closestPointOnPath(path, world, doc.paths)
      if (!hit) return
      const pathPos = hit.segmentIndex + hit.t
      setDrag({ ...drag, pathEnd: pathPos })
      return
    }
  }

  const onPointerUp = () => {
    const store = useTrackEditorStore.getState()
    if (drag?.kind === 'curb') {
      const span = Math.abs(drag.pathEnd - drag.pathStart)
      if (span >= 0.02) {
        store.addCurb(drag.pathId, drag.pathStart, drag.pathEnd, drag.edge, pendingCurbVariant)
        store.setTool('select')
      }
      setDrag(null)
      return
    }
    if (terrainStroke.current.active) {
      const diff = terrainStroke.current.diff
      terrainStroke.current.active = false
      setTerrainStrokeActive(false)
      if (terrainStroke.current.rafId !== null) {
        flushTerrainBrushVisuals()
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
      }
      terrainStroke.current.diff = new Map()
    }
    setDrag(null)
  }

  useEffect(() => {
    return () => {
      if (terrainStroke.current.rafId !== null) {
        cancelAnimationFrame(terrainStroke.current.rafId)
      }
    }
  }, [])

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const screen = screenPointOf(e, svgRef.current)
    const factor = Math.pow(1.0015, -e.deltaY)
    useTrackEditorStore.getState().setViewport(v => zoomAt(v, screen, factor))
  }

  const onContextMenu = (e: React.MouseEvent) => e.preventDefault()

  const previewSegment = (() => {
    if (tool !== 'pen' || !hoverWorld || drag) return null
    const last = (() => {
      if (pen.activePathId) {
        const path = doc.paths.find(p => p.id === pen.activePathId)
        if (!path || path.anchors.length === 0) return null
        return resolveAnchor(doc.paths, path.anchors[path.anchors.length - 1]!)
      }
      if (!pen.startRef) return null
      return getAnchor(doc.paths, pen.startRef.pathId, pen.startRef.anchorIndex)
    })()
    if (!last) return null
    const lastS = worldToScreen(viewport, last.point)
    const hoverS = worldToScreen(viewport, hoverWorld)
    const hasOut = last.outHandle.x !== last.point.x || last.outHandle.y !== last.point.y
    if (hasOut) {
      const c1 = worldToScreen(viewport, last.outHandle)
      return `M ${lastS.x} ${lastS.y} C ${c1.x} ${c1.y} ${hoverS.x} ${hoverS.y} ${hoverS.x} ${hoverS.y}`
    }
    return `M ${lastS.x} ${lastS.y} L ${hoverS.x} ${hoverS.y}`
  })()

  const cursor =
    spaceDown || drag?.kind === 'pan' ? 'grab' : tool === 'pen' ? 'crosshair' : 'default'

  return (
    <svg
      ref={svgRef}
      className='absolute inset-0 h-full w-full'
      style={{
        cursor,
        background: '#0a0a0a',
        userSelect: tool === 'terrain' ? 'none' : undefined,
        WebkitUserSelect: tool === 'terrain' ? 'none' : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onContextMenu={onContextMenu}
    >
      <HeightmapOverlay viewport={viewport} suspendUpdates={terrainStrokeActive} />
      {tool !== 'terrain' && <PenCanvasGrid viewport={viewport} svgRef={svgRef} />}
      <PenCanvasPaths />
      {previewSegment && (
        <path
          d={previewSegment}
          stroke='#60a5fa'
          strokeWidth={1}
          fill='none'
          strokeDasharray='4 4'
          opacity={0.9}
        />
      )}
      <FlowArrowsLayer />
      <PitBoxAreaLayer />
      <CheckpointsLayer />
      <CurbsLayer
        drag={
          drag?.kind === 'curb'
            ? {
                pathId: drag.pathId,
                edge: drag.edge,
                pathStart: drag.pathStart,
                pathEnd: drag.pathEnd,
                variant: pendingCurbVariant,
              }
            : null
        }
        hoverHint={tool === 'curb' && !drag ? curbHoverHint : null}
        hoverVariant={pendingCurbVariant}
      />
      <PenCanvasAnchors />
      {penPathInsertHint &&
        tool === 'pen' &&
        (() => {
          const s = worldToScreen(viewport, penPathInsertHint)
          return (
            <g pointerEvents='none'>
              <circle cx={s.x} cy={s.y} r={8} fill='none' stroke='#fbbf24' strokeWidth={1.5} />
              <line
                x1={s.x - 4}
                y1={s.y}
                x2={s.x + 4}
                y2={s.y}
                stroke='#fbbf24'
                strokeWidth={1.5}
              />
              <line
                x1={s.x}
                y1={s.y - 4}
                x2={s.x}
                y2={s.y + 4}
                stroke='#fbbf24'
                strokeWidth={1.5}
              />
            </g>
          )
        })()}
      {tool === 'terrain' && <TerrainBrushCursor viewport={viewport} world={hoverWorld} />}
    </svg>
  )
}
