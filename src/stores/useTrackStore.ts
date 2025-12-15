import { create } from 'zustand'
import type { TrackLibrary, SavedTrack } from '../types/track'
import { useCustomizationStore, type PlacedObject } from './useCustomizationStore'
import { usePitStore } from './usePitStore'
import {
  DEFAULT_TRACK_NAME,
  DEFAULT_TRACK_OBJECTS,
  DEFAULT_TRACK_PIT_DATA,
} from '../constants/defaultTrack'

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

  // Actions - Track Management
  createTrack: (name: string) => string
  deleteTrack: (id: string) => void
  renameTrack: (id: string, newName: string) => void
  duplicateTrack: (id: string, newName: string) => string

  // Actions - Active Track
  loadTrack: (id: string) => void
  saveCurrentTrack: () => void
  exportCurrentTrack: () => void
  setActiveTrack: (id: string | null) => void
  markDirty: () => void

  // Actions - Library
  loadLibrary: () => void
  saveLibrary: () => void

  // Getters
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
      pitLaneData: null,
    }

    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        tracks: [...state.trackLibrary.tracks, newTrack],
        activeTrackId: newTrack.id,
      },
      isDirty: false,
    }))

    // Clear editor and load empty track
    useCustomizationStore.getState().setPlacedObjects([])
    usePitStore.getState().setPitLaneData(null)

    // Save library
    get().saveLibrary()

    return newTrack.id
  },

  deleteTrack: (id: string) => {
    const state = get()
    const tracks = state.trackLibrary.tracks.filter(t => t.id !== id)

    // If deleting active track, switch to another or null
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

    // Load the new active track or clear editor
    if (newActiveId) {
      get().loadTrack(newActiveId)
    } else {
      useCustomizationStore.getState().setPlacedObjects([])
      usePitStore.getState().setPitLaneData(null)
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
      pitLaneData: original.pitLaneData ? { ...original.pitLaneData } : null,
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

    // Load objects into customization store
    useCustomizationStore.getState().setPlacedObjects(track.objects)

    // Load pit lane data
    usePitStore.getState().setPitLaneData(track.pitLaneData)

    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        activeTrackId: id,
      },
      isDirty: false,
    }))

    get().saveLibrary()
  },

  saveCurrentTrack: () => {
    const state = get()
    const activeId = state.trackLibrary.activeTrackId

    if (!activeId) {
      // No active track, create one
      get().createTrack('My Track')
      return
    }

    const objects = useCustomizationStore.getState().placedObjects
    const pitLaneData = usePitStore.getState().pitLaneData

    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        tracks: state.trackLibrary.tracks.map(t =>
          t.id === activeId
            ? {
                ...t,
                objects: [...objects],
                pitLaneData: pitLaneData ? { ...pitLaneData } : null,
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
    const { pitLaneData } = usePitStore.getState()
    const activeTrack = get().getActiveTrack()

    const trackData = {
      name: activeTrack?.name || 'Exported Track',
      objects: placedObjects,
      pitLaneData,
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
      // Check for existing library
      const libraryData = localStorage.getItem(TRACK_LIBRARY_KEY)

      if (libraryData) {
        const library = JSON.parse(libraryData) as TrackLibrary

        // Add default track if not present and defined
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
            pitLaneData: DEFAULT_TRACK_PIT_DATA ? { ...DEFAULT_TRACK_PIT_DATA } : null,
          }
          library.tracks.unshift(defaultTrack) // Add at the beginning
        }

        set({ trackLibrary: library, isLoading: false })

        // Load active track into editor
        if (library.activeTrackId) {
          const activeTrack = library.tracks.find(t => t.id === library.activeTrackId)
          if (activeTrack) {
            useCustomizationStore.getState().setPlacedObjects(activeTrack.objects)
            usePitStore.getState().setPitLaneData(activeTrack.pitLaneData)
          }
        }

        get().saveLibrary()
        return
      }

      // Migrate from legacy storage
      const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY)
      const newLibrary: TrackLibrary = {
        version: CURRENT_VERSION,
        activeTrackId: null,
        tracks: [],
      }

      // Add default track if defined
      if (DEFAULT_TRACK_OBJECTS.length > 0) {
        const defaultTrack: SavedTrack = {
          id: 'default_track',
          name: DEFAULT_TRACK_NAME,
          createdAt: 0, // Mark as built-in
          updatedAt: 0,
          objectCount: DEFAULT_TRACK_OBJECTS.length,
          objects: [...DEFAULT_TRACK_OBJECTS],
          pitLaneData: DEFAULT_TRACK_PIT_DATA ? { ...DEFAULT_TRACK_PIT_DATA } : null,
        }
        newLibrary.tracks.push(defaultTrack)
        newLibrary.activeTrackId = defaultTrack.id

        // Load default track into editor
        useCustomizationStore.getState().setPlacedObjects(DEFAULT_TRACK_OBJECTS)
        if (DEFAULT_TRACK_PIT_DATA) {
          usePitStore.getState().setPitLaneData(DEFAULT_TRACK_PIT_DATA)
        }
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
            pitLaneData: null,
          }
          newLibrary.tracks.push(migratedTrack)
          newLibrary.activeTrackId = migratedTrack.id

          // Load migrated objects into editor
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
