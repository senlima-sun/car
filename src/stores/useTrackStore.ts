import { create } from 'zustand'
import type { TrackLibrary, SavedTrack } from '../types/track'
import { useCustomizationStore, type PlacedObject } from './useCustomizationStore'
import { useEditorStore } from './useEditorStore'
import { useTerrainStore } from './useTerrainStore'
import { DEFAULT_TRACK_NAME, DEFAULT_TRACK_OBJECTS } from '../constants/defaultTrack'
import { PRESET_TRACKS } from '../constants/tracks'

const LEGACY_STORAGE_KEY = 'car-racing-track'
const TRACK_LIBRARY_KEY = 'car-racing-track-library'
const CURRENT_VERSION = 1

const generateId = (): string => {
  return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const cloneObjects = (objects: PlacedObject[]): PlacedObject[] => structuredClone(objects)

const presetObjectsEqual = (a: PlacedObject[], b: PlacedObject[]): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

const getTrackCenter = (objects: PlacedObject[]): [number, number, number] | null => {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let hasPoint = false

  const addPoint = (x: number, z: number) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
    hasPoint = true
  }

  for (const object of objects) {
    if (object.type === 'track_ribbon' && object.ribbonPoints) {
      for (const point of object.ribbonPoints) {
        addPoint(point.x, point.z)
      }
      continue
    }

    if (object.startPoint) addPoint(object.startPoint[0], object.startPoint[2])
    if (object.endPoint) addPoint(object.endPoint[0], object.endPoint[2])
    if (object.position) addPoint(object.position[0], object.position[2])
  }

  if (!hasPoint) return null
  return [(minX + maxX) / 2, 0, (minZ + maxZ) / 2]
}

interface TrackState {
  trackLibrary: TrackLibrary
  isLoading: boolean
  isDirty: boolean

  createTrack: (name: string) => string
  deleteTrack: (id: string) => void
  renameTrack: (id: string, newName: string) => void
  duplicateTrack: (id: string, newName: string) => string

  loadTrack: (id: string) => void
  loadPresetTrack: (presetId: string) => void
  saveCurrentTrack: () => void
  exportCurrentTrack: () => void
  setActiveTrack: (id: string | null) => void
  markDirty: () => void

  loadLibrary: () => void
  saveLibrary: () => void

  getActiveTrack: () => SavedTrack | null
  getTrackById: (id: string) => SavedTrack | null
}

export const useTrackStore = create<TrackState>((set, get) => ({
  trackLibrary: {
    version: CURRENT_VERSION,
    activeTrackId: null,
    tracks: [],
  },
  isLoading: true,
  isDirty: false,

  createTrack: (name: string) => {
    const newTrack: SavedTrack = {
      id: generateId(),
      name: name.trim() || 'Untitled Track',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      objectCount: 0,
      objects: [],
    }

    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        tracks: [...state.trackLibrary.tracks, newTrack],
        activeTrackId: newTrack.id,
      },
      isDirty: false,
    }))

    useCustomizationStore.getState().setPlacedObjects([])

    get().saveLibrary()

    return newTrack.id
  },

  deleteTrack: (id: string) => {
    const state = get()
    const tracks = state.trackLibrary.tracks.filter(t => t.id !== id)

    let newActiveId = state.trackLibrary.activeTrackId
    if (newActiveId === id) {
      newActiveId = tracks.length > 0 ? tracks[0].id : null
    }

    set({
      trackLibrary: {
        ...state.trackLibrary,
        tracks,
        activeTrackId: newActiveId,
      },
    })

    if (newActiveId) {
      get().loadTrack(newActiveId)
    } else {
      useCustomizationStore.getState().setPlacedObjects([])
    }

    get().saveLibrary()
  },

  renameTrack: (id: string, newName: string) => {
    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        tracks: state.trackLibrary.tracks.map(t =>
          t.id === id
            ? { ...t, name: newName.trim() || 'Untitled Track', updatedAt: Date.now() }
            : t,
        ),
      },
    }))
    get().saveLibrary()
  },

  duplicateTrack: (id: string, newName: string) => {
    const original = get().getTrackById(id)
    if (!original) return ''

    const newTrack: SavedTrack = {
      ...original,
      id: generateId(),
      name: newName.trim() || `${original.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      objects: [...original.objects],
    }

    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        tracks: [...state.trackLibrary.tracks, newTrack],
      },
    }))

    get().saveLibrary()
    return newTrack.id
  },

  loadTrack: (id: string) => {
    const track = get().getTrackById(id)
    if (!track) return

    useCustomizationStore.getState().setPlacedObjects(track.objects)
    const center = getTrackCenter(track.objects)
    if (center) {
      useEditorStore.getState().setCameraTarget(center)
    }

    if (track.heightmap && track.heightmap.length > 0) {
      useTerrainStore.getState().loadHeightmap(track.heightmap)
    } else {
      useTerrainStore.getState().resetHeightmap()
    }

    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        activeTrackId: id,
      },
      isDirty: false,
    }))

    get().saveLibrary()
  },

  loadPresetTrack: (presetId: string) => {
    const preset = PRESET_TRACKS.find(p => p.id === presetId)
    if (!preset) return

    const state = get()
    if (state.isDirty && state.trackLibrary.activeTrackId) {
      get().saveCurrentTrack()
    }

    const existing = state.trackLibrary.tracks.find(t => t.presetId === presetId)
    if (existing && presetObjectsEqual(existing.objects, preset.objects)) {
      get().loadTrack(existing.id)
      return
    }
    if (existing) {
      set(s => ({
        trackLibrary: {
          ...s.trackLibrary,
          tracks: s.trackLibrary.tracks.filter(t => t.id !== existing.id),
        },
      }))
    }

    const newTrack: SavedTrack = {
      id: generateId(),
      name: preset.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      objectCount: preset.objects.length,
      objects: cloneObjects(preset.objects),
      presetId,
    }

    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        tracks: [...state.trackLibrary.tracks, newTrack],
        activeTrackId: newTrack.id,
      },
      isDirty: false,
    }))

    useCustomizationStore.getState().setPlacedObjects(newTrack.objects)
    const center = getTrackCenter(newTrack.objects)
    if (center) {
      useEditorStore.getState().setCameraTarget(center)
    }

    get().saveLibrary()
  },

  saveCurrentTrack: () => {
    const state = get()
    const activeId = state.trackLibrary.activeTrackId

    if (!activeId) {
      get().createTrack('My Track')
      return
    }

    const objects = useCustomizationStore.getState().placedObjects
    const terrainState = useTerrainStore.getState()
    const hasTerrainData = terrainState.heightmap.some(h => h !== 0)
    const heightmap = hasTerrainData ? terrainState.getHeightsArray() : undefined

    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        tracks: state.trackLibrary.tracks.map(t =>
          t.id === activeId
            ? {
                ...t,
                objects: [...objects],
                objectCount: objects.length,
                updatedAt: Date.now(),
                heightmap,
              }
            : t,
        ),
      },
      isDirty: false,
    }))

    get().saveLibrary()
  },

  exportCurrentTrack: () => {
    const { placedObjects } = useCustomizationStore.getState()
    const activeTrack = get().getActiveTrack()
    const terrainState = useTerrainStore.getState()
    const hasTerrainData = terrainState.heightmap.some(h => h !== 0)

    const trackName = activeTrack?.name || 'Exported Track'
    const trackData: Record<string, unknown> = {
      name: trackName,
      objects: placedObjects,
    }
    if (hasTerrainData) {
      trackData.heightmap = terrainState.getHeightsArray()
    }

    const blob = new Blob([JSON.stringify(trackData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trackName.replace(/\s+/g, '_')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  setActiveTrack: (id: string | null) => {
    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        activeTrackId: id,
      },
    }))
  },

  markDirty: () => {
    set({ isDirty: true })
  },

  loadLibrary: () => {
    set({ isLoading: true })

    try {
      const libraryData = localStorage.getItem(TRACK_LIBRARY_KEY)

      if (libraryData) {
        const library = JSON.parse(libraryData) as TrackLibrary

        if (
          DEFAULT_TRACK_OBJECTS.length > 0 &&
          !library.tracks.find(t => t.id === 'default_track')
        ) {
          const defaultTrack: SavedTrack = {
            id: 'default_track',
            name: DEFAULT_TRACK_NAME,
            createdAt: 0,
            updatedAt: 0,
            objectCount: DEFAULT_TRACK_OBJECTS.length,
            objects: [...DEFAULT_TRACK_OBJECTS],
          }
          library.tracks.unshift(defaultTrack)
        }

        library.tracks = library.tracks.map(t => {
          if (!t.presetId) return t
          const preset = PRESET_TRACKS.find(p => p.id === t.presetId)
          if (!preset) return t
          if (presetObjectsEqual(t.objects, preset.objects)) return t
          return {
            ...t,
            name: preset.name,
            updatedAt: Date.now(),
            objectCount: preset.objects.length,
            objects: cloneObjects(preset.objects),
          }
        })

        set({ trackLibrary: library, isLoading: false })

        if (library.activeTrackId) {
          const activeTrack = library.tracks.find(t => t.id === library.activeTrackId)
          if (activeTrack) {
            useCustomizationStore.getState().setPlacedObjects(activeTrack.objects)
            if (activeTrack.heightmap && activeTrack.heightmap.length > 0) {
              useTerrainStore.getState().loadHeightmap(activeTrack.heightmap)
            } else {
              useTerrainStore.getState().resetHeightmap()
            }
          }
        }

        get().saveLibrary()
        return
      }

      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY)
      const newLibrary: TrackLibrary = {
        version: CURRENT_VERSION,
        activeTrackId: null,
        tracks: [],
      }

      if (DEFAULT_TRACK_OBJECTS.length > 0) {
        const defaultTrack: SavedTrack = {
          id: 'default_track',
          name: DEFAULT_TRACK_NAME,
          createdAt: 0,
          updatedAt: 0,
          objectCount: DEFAULT_TRACK_OBJECTS.length,
          objects: [...DEFAULT_TRACK_OBJECTS],
        }
        newLibrary.tracks.push(defaultTrack)
        newLibrary.activeTrackId = defaultTrack.id

        useCustomizationStore.getState().setPlacedObjects(DEFAULT_TRACK_OBJECTS)
      }

      if (legacyData) {
        try {
          const legacyObjects = JSON.parse(legacyData) as PlacedObject[]
          const migratedTrack: SavedTrack = {
            id: generateId(),
            name: 'My Track',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            objectCount: legacyObjects.length,
            objects: legacyObjects,
          }
          newLibrary.tracks.push(migratedTrack)
          newLibrary.activeTrackId = migratedTrack.id

          useCustomizationStore.getState().setPlacedObjects(legacyObjects)
        } catch (e) {
          console.error('Failed to migrate legacy track data:', e)
        }
      }

      set({ trackLibrary: newLibrary, isLoading: false })
      get().saveLibrary()
    } catch (e) {
      console.error('Failed to load track library:', e)
      set({ isLoading: false })
    }
  },

  saveLibrary: () => {
    try {
      const { trackLibrary } = get()
      localStorage.setItem(TRACK_LIBRARY_KEY, JSON.stringify(trackLibrary))
    } catch (e) {
      console.error('Failed to save track library:', e)
    }
  },

  getActiveTrack: () => {
    const state = get()
    if (!state.trackLibrary.activeTrackId) return null
    return state.trackLibrary.tracks.find(t => t.id === state.trackLibrary.activeTrackId) || null
  },

  getTrackById: (id: string) => {
    return get().trackLibrary.tracks.find(t => t.id === id) || null
  },
}))
