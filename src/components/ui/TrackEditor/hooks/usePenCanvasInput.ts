import { useCallback, useState, type RefObject } from 'react'
import { useTrackEditorStore, sameAnchorRef } from '../state/useTrackEditorStore'
import type { Point } from '../geometry/types'
import { getAnchor, resolveAnchor } from '../geometry/path'
import { dist } from '../geometry/point'
import { screenToWorld, worldToScreen, zoomAt } from '../geometry/viewport'
import { screenPointOf } from './usePointerWorld'
import { closestPointOnAnyPath, closestPointOnPath } from '../geometry/closestPoint'
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
} from '../geometry/hitTest'
import type { Drag } from './types'
import type { TerrainBrushStrokeApi } from './useTerrainBrushStroke'

type EditorSnapshot = {
  doc: ReturnType<typeof useTrackEditorStore.getState>['doc']
  viewport: ReturnType<typeof useTrackEditorStore.getState>['viewport']
  tool: ReturnType<typeof useTrackEditorStore.getState>['tool']
  pen: ReturnType<typeof useTrackEditorStore.getState>['pen']
  pendingCurbVariant: ReturnType<typeof useTrackEditorStore.getState>['pendingCurbVariant']
}

type CurbHoverHint = {
  pathId: string
  pathPos: number
  edge: 'left' | 'right'
}

export type PenCanvasInputApi = {
  drag: Drag
  hoverWorld: Point | null
  penPathInsertHint: Point | null
  curbHoverHint: CurbHoverHint | null
  onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void
  onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void
  onPointerUp: () => void
  onWheel: (e: React.WheelEvent<SVGSVGElement>) => void
  onContextMenu: (e: React.MouseEvent) => void
}

export function usePenCanvasInput(args: {
  svgRef: RefObject<SVGSVGElement | null>
  spaceDown: boolean
  terrain: TerrainBrushStrokeApi
  snapshot: EditorSnapshot
}): PenCanvasInputApi {
  const { svgRef, spaceDown, terrain, snapshot } = args
  const { doc, viewport, tool, pen, pendingCurbVariant } = snapshot

  const [drag, setDrag] = useState<Drag>(null)
  const [hoverWorld, setHoverWorld] = useState<Point | null>(null)
  const [penPathInsertHint, setPenPathInsertHint] = useState<Point | null>(null)
  const [curbHoverHint, setCurbHoverHint] = useState<CurbHoverHint | null>(null)

  const worldOf = useCallback(
    (e: { clientX: number; clientY: number }): Point => {
      const s = screenPointOf(e, svgRef.current)
      return screenToWorld(viewport, s)
    },
    [viewport, svgRef],
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
      terrain.startStroke(world.x, world.y)
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
      terrain.continueStroke(world.x, world.y)
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
    terrain.commitStroke()
    setDrag(null)
  }

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const screen = screenPointOf(e, svgRef.current)
    const factor = Math.pow(1.0015, -e.deltaY)
    useTrackEditorStore.getState().setViewport(v => zoomAt(v, screen, factor))
  }

  const onContextMenu = (e: React.MouseEvent) => e.preventDefault()

  return {
    drag,
    hoverWorld,
    penPathInsertHint,
    curbHoverHint,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    onContextMenu,
  }
}
