import { create } from 'zustand'
import type { TrackLibrary, SavedTrack } from '../types/track'
import { useCustomizationStore, type PlacedObject } from './useCustomizationStore'
import { useEditorStore } from './useEditorStore'
import { DEFAULT_TRACK_NAME, DEFAULT_TRACK_OBJECTS } from '../constants/defaultTrack'
import { PRESET_TRACKS } from '../constants/tracks'

const LEGACY_STORAGE_KEY = 'car-racing-track'
const TRACK_LIBRARY_KEY = 'car-racing-track-library'
const CURRENT_VERSION = 1

const generateId = (): string => {
  return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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

    const newTrack: SavedTrack = {
      id: generateId(),
      name: preset.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      objectCount: preset.objects.length,
      objects: [...preset.objects],
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

    const roads = newTrack.objects.filter(o => o.type === 'road' && o.startPoint)
    if (roads.length > 0) {
      let sumX = 0,
        sumZ = 0,
        count = 0
      for (const r of roads) {
        if (r.startPoint) {
          sumX += r.startPoint[0]
          sumZ += r.startPoint[2]
          count++
        }
        if (r.endPoint) {
          sumX += r.endPoint[0]
          sumZ += r.endPoint[2]
          count++
        }
      }
      if (count > 0) {
        useEditorStore.getState().setCameraTarget([sumX / count, 0, sumZ / count])
      }
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

    const trackData = {
      name: activeTrack?.name || 'Exported Track',
      objects: placedObjects,
    }

    const blob = new Blob([JSON.stringify(trackData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${trackData.name.replace(/\s+/g, '_')}.json`
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

        set({ trackLibrary: library, isLoading: false })

        if (library.activeTrackId) {
          const activeTrack = library.tracks.find(t => t.id === library.activeTrackId)
          if (activeTrack) {
            useCustomizationStore.getState().setPlacedObjects(activeTrack.objects)
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
