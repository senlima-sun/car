import { create } from 'zustand'
import type { EditorPart, GeometryType, TransformMode, CarPartConfig, HistoryEntry } from '@/types/partEditor'
import { GEOMETRY_DEFAULTS, DEFAULT_MATERIAL, PART_EDITOR_STORAGE_KEY, MAX_HISTORY_LENGTH } from '@/constants/partEditor'

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

interface PartEditorState {
  // Part data
  parts: EditorPart[]
  selectedPartId: string | null

  // Editor modes
  transformMode: TransformMode
  snapEnabled: boolean
  snapValue: number
  rotationSnapValue: number
  showReferenceModel: boolean

  // History
  history: HistoryEntry[]
  historyIndex: number

  // Config metadata
  configName: string

  // Actions - Part CRUD
  addPart: (geometryType: GeometryType) => void
  removePart: (id: string) => void
  duplicatePart: (id: string) => void
  updatePart: (id: string, updates: Partial<EditorPart>) => void
  renamePart: (id: string, name: string) => void

  // Actions - Selection
  selectPart: (id: string | null) => void

  // Actions - Transform
  setTransformMode: (mode: TransformMode) => void
  setSnapEnabled: (enabled: boolean) => void
  setSnapValue: (value: number) => void
  setRotationSnapValue: (value: number) => void

  // Actions - View
  toggleReferenceModel: () => void

  // Actions - History
  undo: () => void
  redo: () => void
  pushHistory: () => void

  // Actions - Import/Export
  exportConfig: () => CarPartConfig
  importConfig: (config: CarPartConfig) => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => boolean

  // Actions - Reset
  clearAll: () => void
  setConfigName: (name: string) => void

  // Getters
  getSelectedPart: () => EditorPart | null
  canUndo: () => boolean
  canRedo: () => boolean
}

export const usePartEditorStore = create<PartEditorState>((set, get) => ({
  // Initial state
  parts: [],
  selectedPartId: null,
  transformMode: 'translate',
  snapEnabled: true,
  snapValue: 0.25,
  rotationSnapValue: Math.PI / 12,
  showReferenceModel: true,
  history: [],
  historyIndex: -1,
  configName: 'Untitled Part',

  // Part CRUD
  addPart: (geometryType) => {
    const defaults = GEOMETRY_DEFAULTS[geometryType]
    const existingCount = get().parts.filter(p => p.geometryType === geometryType).length
    const newPart: EditorPart = {
      id: generateId(),
      name: `${defaults.name}_${existingCount + 1}`,
      geometryType,
      args: [...defaults.args],
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: DEFAULT_MATERIAL.color,
      metalness: DEFAULT_MATERIAL.metalness,
      roughness: DEFAULT_MATERIAL.roughness,
      // Add points for extrude geometry
      ...(defaults.points ? { points: defaults.points.map(p => [...p] as [number, number]) } : {}),
      // Add height profile for extrude geometry
      ...(defaults.heightProfile ? { heightProfile: defaults.heightProfile.map(p => [...p] as [number, number]) } : {}),
      ...(defaults.heightProfileSmooth !== undefined ? { heightProfileSmooth: defaults.heightProfileSmooth } : {}),
    }
    set((state) => ({
      parts: [...state.parts, newPart],
      selectedPartId: newPart.id,
    }))
    get().pushHistory()
  },

  removePart: (id) => {
    set((state) => ({
      parts: state.parts.filter(p => p.id !== id),
      selectedPartId: state.selectedPartId === id ? null : state.selectedPartId,
    }))
    get().pushHistory()
  },

  duplicatePart: (id) => {
    const part = get().parts.find(p => p.id === id)
    if (!part) return
    const newPart: EditorPart = {
      ...part,
      id: generateId(),
      name: `${part.name}_copy`,
      position: [part.position[0] + 0.5, part.position[1], part.position[2]],
      // Deep copy points if they exist
      ...(part.points ? { points: part.points.map(p => [...p] as [number, number]) } : {}),
      // Deep copy holes if they exist
      ...(part.holes ? { holes: part.holes.map(hole => hole.map(p => [...p] as [number, number])) } : {}),
      // Deep copy height profile if it exists
      ...(part.heightProfile ? { heightProfile: part.heightProfile.map(p => [...p] as [number, number]) } : {}),
    }
    set((state) => ({
      parts: [...state.parts, newPart],
      selectedPartId: newPart.id,
    }))
    get().pushHistory()
  },

  updatePart: (id, updates) => {
    set((state) => ({
      parts: state.parts.map(p =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }))
  },

  renamePart: (id, name) => {
    set((state) => ({
      parts: state.parts.map(p =>
        p.id === id ? { ...p, name } : p
      ),
    }))
  },

  // Selection
  selectPart: (id) => {
    set({ selectedPartId: id })
  },

  // Transform
  setTransformMode: (mode) => {
    set({ transformMode: mode })
  },

  setSnapEnabled: (enabled) => {
    set({ snapEnabled: enabled })
  },

  setSnapValue: (value) => {
    set({ snapValue: value })
  },

  setRotationSnapValue: (value) => {
    set({ rotationSnapValue: value })
  },

  // View
  toggleReferenceModel: () => {
    set((state) => ({ showReferenceModel: !state.showReferenceModel }))
  },

  // History
  pushHistory: () => {
    const { parts, selectedPartId, history, historyIndex } = get()
    const newEntry: HistoryEntry = {
      parts: JSON.parse(JSON.stringify(parts)),
      selectedId: selectedPartId,
    }
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newEntry)
    if (newHistory.length > MAX_HISTORY_LENGTH) {
      newHistory.shift()
    }
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    })
  },

  undo: () => {
    const { historyIndex, history } = get()
    if (historyIndex <= 0) return
    const prevIndex = historyIndex - 1
    const entry = history[prevIndex]
    set({
      parts: JSON.parse(JSON.stringify(entry.parts)),
      selectedPartId: entry.selectedId,
      historyIndex: prevIndex,
    })
  },

  redo: () => {
    const { historyIndex, history } = get()
    if (historyIndex >= history.length - 1) return
    const nextIndex = historyIndex + 1
    const entry = history[nextIndex]
    set({
      parts: JSON.parse(JSON.stringify(entry.parts)),
      selectedPartId: entry.selectedId,
      historyIndex: nextIndex,
    })
  },

  // Import/Export
  exportConfig: () => {
    const { parts, configName } = get()
    const now = Date.now()
    return {
      version: 1,
      name: configName,
      createdAt: now,
      updatedAt: now,
      parts: JSON.parse(JSON.stringify(parts)),
    }
  },

  importConfig: (config) => {
    set({
      parts: config.parts,
      configName: config.name,
      selectedPartId: null,
      history: [],
      historyIndex: -1,
    })
    get().pushHistory()
  },

  saveToLocalStorage: () => {
    const config = get().exportConfig()
    try {
      localStorage.setItem(PART_EDITOR_STORAGE_KEY, JSON.stringify(config))
    } catch (e) {
      console.error('Failed to save to localStorage:', e)
    }
  },

  loadFromLocalStorage: () => {
    try {
      const data = localStorage.getItem(PART_EDITOR_STORAGE_KEY)
      if (data) {
        const config = JSON.parse(data) as CarPartConfig
        get().importConfig(config)
        return true
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e)
    }
    return false
  },

  // Reset
  clearAll: () => {
    set({
      parts: [],
      selectedPartId: null,
      history: [],
      historyIndex: -1,
      configName: 'Untitled Part',
    })
  },

  setConfigName: (name) => {
    set({ configName: name })
  },

  // Getters
  getSelectedPart: () => {
    const { parts, selectedPartId } = get()
    return parts.find(p => p.id === selectedPartId) || null
  },

  canUndo: () => {
    return get().historyIndex > 0
  },

  canRedo: () => {
    const { historyIndex, history } = get()
    return historyIndex < history.length - 1
  },
}))
