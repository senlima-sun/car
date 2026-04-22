import { create } from 'zustand'
import type {
  Anchor,
  AnchorRef,
  CheckpointKind,
  CheckpointMarker,
  EditorDocument,
  HandleRef,
  HandleType,
  Path,
  PitBoxArea,
  Point,
  RaceDirection,
} from '../geometry/types'
import { isAnchorRefSlot } from '../geometry/types'
import { add, clonePt, eq, len, lerp, normalize, reflect, sub } from '../geometry/point'
import { makeAnchor, makePath, nextId } from '../geometry/path'
import { identityViewport, type Viewport } from '../geometry/viewport'

export type Tool = 'pen' | 'select' | 'start-finish' | 'sector' | 'pit-area'

type PenState = {
  activePathId: string | null
  hoverClose: boolean
  startRef: AnchorRef | null
}

type Snapshot = {
  doc: EditorDocument
  checkpoints: CheckpointMarker[]
  raceDirection: RaceDirection
  pitBoxAreas: PitBoxArea[]
}

type EditorState = {
  doc: EditorDocument
  checkpoints: CheckpointMarker[]
  raceDirection: RaceDirection
  pitBoxAreas: PitBoxArea[]
  viewport: Viewport
  tool: Tool
  selected: AnchorRef | null
  selectedAnchors: AnchorRef[]
  selectedPitBoxAreaId: string | null
  pen: PenState
  past: Snapshot[]
  future: Snapshot[]

  setTool: (t: Tool) => void
  setViewport: (v: Viewport | ((prev: Viewport) => Viewport)) => void

  beginPath: (world: Point) => string
  appendAnchor: (pathId: string, world: Point) => number
  appendAnchorRef: (pathId: string, ref: AnchorRef) => number
  beginPathWithRef: (ref: AnchorRef) => string
  insertAnchorAt: (pathId: string, segmentIndex: number, t: number) => number
  updateAnchorHandles: (
    pathId: string,
    anchorIndex: number,
    outWorld: Point,
    mirror: boolean,
  ) => void
  closeActivePath: () => void
  finishActivePath: () => void

  setAnchorPoint: (ref: AnchorRef, world: Point, keepHandles: boolean) => void
  setHandle: (ref: HandleRef, world: Point, opts: { breakSymmetry: boolean }) => void
  toggleAnchorType: (ref: AnchorRef) => void
  setHandleType: (ref: AnchorRef, type: HandleType) => void
  deleteAnchor: (ref: AnchorRef) => void

  setSelected: (ref: AnchorRef | null) => void
  toggleAnchorInSelection: (ref: AnchorRef) => void
  clearSelection: () => void
  setPenStartRef: (ref: AnchorRef | null) => void
  setHoverClose: (v: boolean) => void

  addCheckpoint: (kind: CheckpointKind, pathId: string, segmentIndex: number, t: number) => void
  deleteCheckpoint: (id: string) => void
  setRaceDirection: (d: RaceDirection) => void

  markPitLaneSegments: (pathId: string, segmentIndices: number[]) => void
  unmarkPitLaneSegments: (pathId: string, segmentIndices: number[]) => void

  addPitBoxArea: (position: Point) => string
  updatePitBoxArea: (id: string, updates: Partial<Omit<PitBoxArea, 'id'>>) => void
  deletePitBoxArea: (id: string) => void
  setSelectedPitBoxAreaId: (id: string | null) => void

  commit: () => void
  undo: () => void
  redo: () => void

  newDocument: () => void
  loadDocument: (next: {
    doc: EditorDocument
    checkpoints: CheckpointMarker[]
    raceDirection: RaceDirection
    pitBoxAreas: PitBoxArea[]
  }) => void
}

const makeDoc = (): EditorDocument => ({ paths: [] })

const cloneDoc = (d: EditorDocument): EditorDocument => ({
  paths: d.paths.map(p => ({
    ...p,
    anchors: p.anchors.map(a => {
      if (isAnchorRefSlot(a)) return { ...a }
      return {
        ...a,
        point: clonePt(a.point),
        inHandle: clonePt(a.inHandle),
        outHandle: clonePt(a.outHandle),
      }
    }),
  })),
})

const snapshotOf = (s: {
  doc: EditorDocument
  checkpoints: CheckpointMarker[]
  raceDirection: RaceDirection
  pitBoxAreas: PitBoxArea[]
}): Snapshot => ({
  doc: cloneDoc(s.doc),
  checkpoints: s.checkpoints.map(c => ({ ...c })),
  raceDirection: s.raceDirection,
  pitBoxAreas: s.pitBoxAreas.map(a => ({ ...a, position: clonePt(a.position) })),
})

function findPath(doc: EditorDocument, id: string): Path | null {
  return doc.paths.find(p => p.id === id) ?? null
}

function resolveOwner(
  doc: EditorDocument,
  pathId: string,
  anchorIndex: number,
  visited: Set<string> = new Set(),
): { path: Path; index: number; anchor: Anchor } | null {
  const key = `${pathId}:${anchorIndex}`
  if (visited.has(key)) return null
  visited.add(key)
  const path = findPath(doc, pathId)
  if (!path) return null
  const slot = path.anchors[anchorIndex]
  if (!slot) return null
  if (!isAnchorRefSlot(slot)) {
    return { path, index: anchorIndex, anchor: slot }
  }
  return resolveOwner(doc, slot.pathId, slot.anchorIndex, visited)
}

function applyHandleConstraint(a: Anchor, which: 'in' | 'out', breakSymmetry: boolean): void {
  if (a.handleType === 'corner') return
  if (breakSymmetry) {
    a.handleType = 'corner'
    return
  }
  const other = which === 'in' ? 'out' : 'in'
  const moved = which === 'in' ? a.inHandle : a.outHandle
  const pivot = a.point
  const movedVec = sub(moved, pivot)
  const movedLen = len(movedVec)

  if (a.handleType === 'mirror') {
    const otherPos = reflect(pivot, moved)
    if (other === 'in') a.inHandle = otherPos
    else a.outHandle = otherPos
    return
  }

  const otherPt = other === 'in' ? a.inHandle : a.outHandle
  const otherVec = sub(otherPt, pivot)
  const otherLen = len(otherVec)
  if (movedLen < 1e-6) return
  const dir = normalize(movedVec)
  const otherNew = add(pivot, { x: -dir.x * otherLen, y: -dir.y * otherLen })
  if (other === 'in') a.inHandle = otherNew
  else a.outHandle = otherNew
}

const HISTORY_LIMIT = 100

function sameAnchorRef(a: AnchorRef | null, b: AnchorRef | null): boolean {
  return a?.pathId === b?.pathId && a?.anchorIndex === b?.anchorIndex
}

export const useTrackEditorStore = create<EditorState>((set, get) => ({
  doc: makeDoc(),
  checkpoints: [],
  raceDirection: 'forward',
  pitBoxAreas: [],
  viewport: identityViewport(),
  tool: 'pen',
  selected: null,
  selectedAnchors: [],
  selectedPitBoxAreaId: null,
  pen: { activePathId: null, hoverClose: false, startRef: null },
  past: [],
  future: [],

  setTool: t =>
    set(s => {
      if (t === s.tool) return s
      return {
        tool: t,
        pen: {
          activePathId: null,
          hoverClose: false,
          startRef: t === 'pen' ? s.selected : null,
        },
        selected: t === 'select' ? s.selected : null,
        selectedAnchors: t === 'select' ? s.selectedAnchors : [],
        selectedPitBoxAreaId: t === 'select' ? s.selectedPitBoxAreaId : null,
      }
    }),

  setViewport: v =>
    set(s => ({
      viewport: typeof v === 'function' ? v(s.viewport) : v,
    })),

  beginPath: world => {
    const a = makeAnchor(world)
    const p = makePath(a)
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    set({
      doc: { ...get().doc, paths: [...get().doc.paths, p] },
      pen: { activePathId: p.id, hoverClose: false, startRef: null },
      future: [],
      past,
    })
    return p.id
  },

  appendAnchor: (pathId, world) => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    let anchorIndex = 0
    set(s => {
      const doc = cloneDoc(s.doc)
      const path = findPath(doc, pathId)
      if (!path) return s
      const a = makeAnchor(world)
      path.anchors.push(a)
      anchorIndex = path.anchors.length - 1
      return { doc, past, future: [] }
    })
    return anchorIndex
  },

  appendAnchorRef: (pathId, ref) => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    let index = 0
    set(s => {
      const doc = cloneDoc(s.doc)
      const path = findPath(doc, pathId)
      if (!path) return s
      path.anchors.push({
        kind: 'ref',
        pathId: ref.pathId,
        anchorIndex: ref.anchorIndex,
      })
      index = path.anchors.length - 1
      return { doc, past, future: [] }
    })
    return index
  },

  beginPathWithRef: ref => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    const p = makePath()
    p.anchors.push({
      kind: 'ref',
      pathId: ref.pathId,
      anchorIndex: ref.anchorIndex,
    })
    set(s => ({
      doc: { ...s.doc, paths: [...s.doc.paths, p] },
      pen: { activePathId: p.id, hoverClose: false, startRef: null },
      past,
      future: [],
    }))
    return p.id
  },

  insertAnchorAt: (pathId, segmentIndex, t) => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    let insertedIndex = -1
    set(s => {
      const doc = cloneDoc(s.doc)
      const path = findPath(doc, pathId)
      if (!path) return s
      const segCount = path.closed ? path.anchors.length : Math.max(0, path.anchors.length - 1)
      if (segmentIndex < 0 || segmentIndex >= segCount) return s

      const fromOwner = resolveOwner(doc, pathId, segmentIndex) ?? null
      const toIdx = segmentIndex === path.anchors.length - 1 ? 0 : segmentIndex + 1
      const toOwner = resolveOwner(doc, pathId, toIdx) ?? null
      if (!fromOwner || !toOwner) return s

      const p0 = fromOwner.anchor.point
      const p3 = toOwner.anchor.point
      const hasOut = !eq(fromOwner.anchor.outHandle, p0)
      const hasIn = !eq(toOwner.anchor.inHandle, p3)

      let newAnchor: Anchor
      const insertAt = segmentIndex + 1

      if (!hasOut && !hasIn) {
        const q3 = lerp(p0, p3, t)
        newAnchor = makeAnchor(q3)
      } else {
        const c1 = hasOut ? fromOwner.anchor.outHandle : p0
        const c2 = hasIn ? toOwner.anchor.inHandle : p3
        const q1 = lerp(p0, c1, t)
        const mid = lerp(c1, c2, t)
        const q5 = lerp(c2, p3, t)
        const q2 = lerp(q1, mid, t)
        const q4 = lerp(mid, q5, t)
        const q3 = lerp(q2, q4, t)
        fromOwner.anchor.outHandle = clonePt(q1)
        fromOwner.anchor.handleType = 'corner'
        toOwner.anchor.inHandle = clonePt(q5)
        toOwner.anchor.handleType = 'corner'
        newAnchor = makeAnchor(q3, q2, q4)
        newAnchor.handleType = 'corner'
      }

      path.anchors.splice(insertAt, 0, newAnchor)
      insertedIndex = insertAt
      if (path.pitLaneSegments) {
        path.pitLaneSegments = path.pitLaneSegments
          .flatMap(i => (i === segmentIndex ? [i, i + 1] : i > segmentIndex ? [i + 1] : [i]))
          .sort((a, b) => a - b)
      }
      const checkpoints = s.checkpoints.map(c => {
        if (c.pathId !== pathId) return c
        if (c.segmentIndex > segmentIndex) {
          return { ...c, segmentIndex: c.segmentIndex + 1 }
        }
        return c
      })
      return { doc, checkpoints, past, future: [] }
    })
    return insertedIndex
  },

  updateAnchorHandles: (pathId, anchorIndex, outWorld, mirror) => {
    set(s => {
      const doc = cloneDoc(s.doc)
      const owner = resolveOwner(doc, pathId, anchorIndex)
      if (!owner) return s
      const a = owner.anchor
      a.outHandle = clonePt(outWorld)
      if (mirror) {
        a.inHandle = reflect(a.point, outWorld)
        a.handleType = 'mirror'
      }
      return { doc }
    })
  },

  closeActivePath: () => {
    const id = get().pen.activePathId
    if (!id) return
    set(s => {
      const doc = cloneDoc(s.doc)
      const path = findPath(doc, id)
      if (!path) return s
      path.closed = true
      return {
        doc,
        pen: { activePathId: null, hoverClose: false, startRef: null },
      }
    })
  },

  finishActivePath: () => {
    set({ pen: { activePathId: null, hoverClose: false, startRef: null } })
  },

  setAnchorPoint: (ref, world, keepHandles) => {
    set(s => {
      const doc = cloneDoc(s.doc)
      const owner = resolveOwner(doc, ref.pathId, ref.anchorIndex)
      if (!owner) return s
      const a = owner.anchor
      if (keepHandles) {
        const dx = world.x - a.point.x
        const dy = world.y - a.point.y
        a.point = clonePt(world)
        a.inHandle = { x: a.inHandle.x + dx, y: a.inHandle.y + dy }
        a.outHandle = { x: a.outHandle.x + dx, y: a.outHandle.y + dy }
      } else {
        a.point = clonePt(world)
      }
      return { doc }
    })
  },

  setHandle: (ref, world, { breakSymmetry }) => {
    set(s => {
      const doc = cloneDoc(s.doc)
      const owner = resolveOwner(doc, ref.pathId, ref.anchorIndex)
      if (!owner) return s
      const a = owner.anchor
      if (ref.which === 'in') a.inHandle = clonePt(world)
      else a.outHandle = clonePt(world)
      applyHandleConstraint(a, ref.which, breakSymmetry)
      return { doc }
    })
  },

  toggleAnchorType: ref => {
    set(s => {
      const doc = cloneDoc(s.doc)
      const owner = resolveOwner(doc, ref.pathId, ref.anchorIndex)
      if (!owner) return s
      const a = owner.anchor
      const path = owner.path
      if (a.handleType === 'corner') {
        const prevSlot = path.anchors[owner.index - 1]
        const nextSlot = path.anchors[owner.index + 1]
        const prev = prevSlot ? resolveOwner(doc, path.id, owner.index - 1)?.anchor : null
        const next = nextSlot ? resolveOwner(doc, path.id, owner.index + 1)?.anchor : null
        const dir = prev && next ? normalize(sub(next.point, prev.point)) : { x: 1, y: 0 }
        const h = 40
        a.outHandle = { x: a.point.x + dir.x * h, y: a.point.y + dir.y * h }
        a.inHandle = { x: a.point.x - dir.x * h, y: a.point.y - dir.y * h }
        a.handleType = 'mirror'
      } else {
        a.inHandle = clonePt(a.point)
        a.outHandle = clonePt(a.point)
        a.handleType = 'corner'
      }
      return { doc }
    })
  },

  setHandleType: (ref, type) => {
    set(s => {
      const doc = cloneDoc(s.doc)
      const owner = resolveOwner(doc, ref.pathId, ref.anchorIndex)
      if (!owner) return s
      owner.anchor.handleType = type
      return { doc }
    })
  },

  deleteAnchor: ref => {
    set(s => {
      const doc = cloneDoc(s.doc)
      const path = findPath(doc, ref.pathId)
      if (!path) return s
      if (ref.anchorIndex < 0 || ref.anchorIndex >= path.anchors.length) return s
      path.anchors.splice(ref.anchorIndex, 1)
      if (path.anchors.length < 2) path.closed = false
      if (path.anchors.length === 0) {
        doc.paths = doc.paths.filter(p => p.id !== path.id)
      }
      const segmentLimit = path.closed ? path.anchors.length : Math.max(0, path.anchors.length - 1)
      const checkpoints = s.checkpoints.filter(c => {
        if (c.pathId !== ref.pathId) return true
        return c.segmentIndex < segmentLimit
      })
      if (path.pitLaneSegments) {
        const shifted = path.pitLaneSegments
          .filter(i => i !== ref.anchorIndex - 1 && i !== ref.anchorIndex)
          .map(i => (i > ref.anchorIndex ? i - 1 : i))
          .filter(i => i >= 0 && i < segmentLimit)
        if (shifted.length === 0) delete path.pitLaneSegments
        else path.pitLaneSegments = shifted
      }
      return { doc, checkpoints, selected: null, selectedAnchors: [] }
    })
  },

  setSelected: ref =>
    set({
      selected: ref,
      selectedAnchors: ref ? [ref] : [],
    }),

  toggleAnchorInSelection: ref =>
    set(s => {
      const exists = s.selectedAnchors.some(
        a => a.pathId === ref.pathId && a.anchorIndex === ref.anchorIndex,
      )
      const next = exists
        ? s.selectedAnchors.filter(
            a => !(a.pathId === ref.pathId && a.anchorIndex === ref.anchorIndex),
          )
        : [...s.selectedAnchors, ref]
      return {
        selectedAnchors: next,
        selected: next.length > 0 ? next[next.length - 1]! : null,
      }
    }),

  clearSelection: () => set({ selected: null, selectedAnchors: [] }),

  setPenStartRef: ref =>
    set(s => ({
      pen: { ...s.pen, startRef: ref },
    })),

  setHoverClose: v => set(s => ({ pen: { ...s.pen, hoverClose: v } })),

  markPitLaneSegments: (pathId, segmentIndices) => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    set(s => {
      const doc = cloneDoc(s.doc)
      const path = findPath(doc, pathId)
      if (!path) return s
      const set1 = new Set(path.pitLaneSegments ?? [])
      for (const i of segmentIndices) set1.add(i)
      path.pitLaneSegments = Array.from(set1).sort((a, b) => a - b)
      return { doc, past, future: [] }
    })
  },

  unmarkPitLaneSegments: (pathId, segmentIndices) => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    set(s => {
      const doc = cloneDoc(s.doc)
      const path = findPath(doc, pathId)
      if (!path) return s
      const drop = new Set(segmentIndices)
      path.pitLaneSegments = (path.pitLaneSegments ?? []).filter(i => !drop.has(i))
      if (path.pitLaneSegments.length === 0) delete path.pitLaneSegments
      return { doc, past, future: [] }
    })
  },

  addPitBoxArea: position => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    const id = nextId('pitbox')
    set(s => ({
      pitBoxAreas: [...s.pitBoxAreas, { id, position: clonePt(position), rotation: 0 }],
      selectedPitBoxAreaId: id,
      past,
      future: [],
    }))
    return id
  },

  updatePitBoxArea: (id, updates) => {
    set(s => ({
      pitBoxAreas: s.pitBoxAreas.map(a =>
        a.id === id
          ? {
              ...a,
              ...updates,
              position: updates.position ? clonePt(updates.position) : a.position,
            }
          : a,
      ),
    }))
  },

  deletePitBoxArea: id => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    set(s => ({
      pitBoxAreas: s.pitBoxAreas.filter(a => a.id !== id),
      selectedPitBoxAreaId: s.selectedPitBoxAreaId === id ? null : s.selectedPitBoxAreaId,
      past,
      future: [],
    }))
  },

  setSelectedPitBoxAreaId: id => set({ selectedPitBoxAreaId: id }),

  addCheckpoint: (kind, pathId, segmentIndex, t) => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    set(s => {
      const next: CheckpointMarker = {
        id: nextId('cp'),
        kind,
        pathId,
        segmentIndex,
        t,
      }
      let checkpoints: CheckpointMarker[]
      if (kind === 'start-finish') {
        checkpoints = [...s.checkpoints.filter(c => c.kind !== 'start-finish'), next]
      } else {
        checkpoints = [...s.checkpoints, next]
      }
      return { checkpoints, past, future: [] }
    })
  },

  deleteCheckpoint: id => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    set(s => ({
      checkpoints: s.checkpoints.filter(c => c.id !== id),
      past,
      future: [],
    }))
  },

  setRaceDirection: d => {
    const past = [...get().past, snapshotOf(get())].slice(-HISTORY_LIMIT)
    set({ raceDirection: d, past, future: [] })
  },

  commit: () => {
    set(s => ({
      past: [...s.past, snapshotOf(s)].slice(-HISTORY_LIMIT),
      future: [],
    }))
  },

  undo: () => {
    set(s => {
      if (s.past.length === 0) return s
      const prev = s.past[s.past.length - 1]!
      return {
        past: s.past.slice(0, -1),
        future: [snapshotOf(s), ...s.future].slice(0, HISTORY_LIMIT),
        doc: prev.doc,
        checkpoints: prev.checkpoints,
        raceDirection: prev.raceDirection,
        pitBoxAreas: prev.pitBoxAreas,
        pen: { activePathId: null, hoverClose: false, startRef: null },
        selected: null,
        selectedAnchors: [],
        selectedPitBoxAreaId: null,
      }
    })
  },

  redo: () => {
    set(s => {
      if (s.future.length === 0) return s
      const next = s.future[0]!
      return {
        past: [...s.past, snapshotOf(s)].slice(-HISTORY_LIMIT),
        future: s.future.slice(1),
        doc: next.doc,
        checkpoints: next.checkpoints,
        raceDirection: next.raceDirection,
        pitBoxAreas: next.pitBoxAreas,
        pen: { activePathId: null, hoverClose: false, startRef: null },
        selected: null,
        selectedAnchors: [],
        selectedPitBoxAreaId: null,
      }
    })
  },

  newDocument: () => {
    set({
      doc: makeDoc(),
      checkpoints: [],
      raceDirection: 'forward',
      pitBoxAreas: [],
      past: [],
      future: [],
      pen: { activePathId: null, hoverClose: false, startRef: null },
      selected: null,
      selectedAnchors: [],
      selectedPitBoxAreaId: null,
    })
  },

  loadDocument: next => {
    set({
      doc: cloneDoc(next.doc),
      checkpoints: next.checkpoints.map(checkpoint => ({ ...checkpoint })),
      raceDirection: next.raceDirection,
      pitBoxAreas: next.pitBoxAreas.map(area => ({
        ...area,
        position: clonePt(area.position),
      })),
      past: [],
      future: [],
      pen: { activePathId: null, hoverClose: false, startRef: null },
      selected: null,
      selectedAnchors: [],
      selectedPitBoxAreaId: null,
    })
  },
}))

export { nextId, sameAnchorRef }
