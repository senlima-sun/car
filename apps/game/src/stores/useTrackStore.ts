import { create } from 'zustand'
import type { HeightmapSource, TrackLibrary, SavedTrack } from '../types/track'
import { useCustomizationStore, type PlacedObject } from './useCustomizationStore'
import { useEditorStore } from './useEditorStore'
import { useTerrainStore } from './useTerrainStore'
import { getPresetTrack } from '../constants/tracks'
import { exportTrack } from '../utils/trackExport'
import { readLibrary, writeLibrary } from '../utils/trackLibraryDB'
import { getTerrainHeightmapForPreset } from '../utils/terrainSidecar'

let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null
let saveInFlight: Promise<void> | null = null
let savePending = false
let lastWrittenLibrary: TrackLibrary | null = null
let presetLoadSeq = 0

const debouncedSaveLibrary = (saveFn: () => void): void => {
  if (saveDebounceTimer !== null) clearTimeout(saveDebounceTimer)
  saveDebounceTimer = setTimeout(() => {
    saveDebounceTimer = null
    saveFn()
  }, 500)
}

const LEGACY_STORAGE_KEY = 'car-racing-track'
const TRACK_LIBRARY_KEY = 'car-racing-track-library'
const CURRENT_VERSION = 1
const DEFAULT_TRACK_ID = 'default_track'

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
  loadedOnce: boolean
  isDirty: boolean
  isReadOnlyMigrationShim: boolean
  migrationError?: string

  createTrack: (name: string) => string
  deleteTrack: (id: string) => void
  renameTrack: (id: string, newName: string) => void
  duplicateTrack: (id: string, newName: string) => string

  loadTrack: (id: string) => void
  loadPresetTrack: (presetId: string) => Promise<void>
  saveCurrentTrack: () => void
  exportCurrentTrack: () => void
  setActiveTrack: (id: string | null) => void
  markDirty: () => void

  loadLibrary: () => Promise<void>
  saveLibrary: () => Promise<void>

  getActiveTrack: () => SavedTrack | null
  getTrackById: (id: string) => SavedTrack | null
}

export const useTrackStore = create<TrackState>((set, get) => ({
  trackLibrary: {
    version: CURRENT_VERSION,
    activeTrackId: null,
    tracks: [],
  },
  isLoading: false,
  loadedOnce: false,
  isDirty: false,
  isReadOnlyMigrationShim: false,

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

    debouncedSaveLibrary(() => get().saveLibrary())

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

    debouncedSaveLibrary(() => get().saveLibrary())
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
    debouncedSaveLibrary(() => get().saveLibrary())
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

    debouncedSaveLibrary(() => get().saveLibrary())
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

    const heightmap = track.heightmap && track.heightmap.length > 0 ? track.heightmap : null
    if (heightmap) {
      useTerrainStore.getState().loadHeightmap(heightmap)
    } else {
      useTerrainStore.getState().resetHeightmap()
    }

    const migratedSource: HeightmapSource =
      track.heightmapSource ?? (heightmap?.some(h => h !== 0) ? 'user' : 'none')

    set(state => ({
      trackLibrary: {
        ...state.trackLibrary,
        activeTrackId: id,
        tracks:
          migratedSource === track.heightmapSource
            ? state.trackLibrary.tracks
            : state.trackLibrary.tracks.map(t =>
                t.id === id ? { ...t, heightmapSource: migratedSource } : t,
              ),
      },
      isDirty: false,
    }))

    debouncedSaveLibrary(() => get().saveLibrary())
  },

  loadPresetTrack: async (presetId: string) => {
    const preset = getPresetTrack(presetId)
    if (!preset) return

    const seq = ++presetLoadSeq

    const state = get()
    if (state.isDirty && state.trackLibrary.activeTrackId) {
      get().saveCurrentTrack()
    }

    const existing = state.trackLibrary.tracks.find(t => t.presetId === presetId)
    if (existing && presetObjectsEqual(existing.objects, preset.objects)) {
      const existingHasOwnTerrain =
        existing.heightmapSource === 'user' ||
        existing.heightmapSource === 'sidecar' ||
        (existing.heightmap?.some(h => h !== 0) ?? false)
      if (existingHasOwnTerrain) {
        get().loadTrack(existing.id)
        return
      }
    }
    if (existing) {
      set(s => ({
        trackLibrary: {
          ...s.trackLibrary,
          tracks: s.trackLibrary.tracks.filter(t => t.id !== existing.id),
        },
      }))
    }

    const sidecar = await getTerrainHeightmapForPreset(presetId).catch(() => null)
    if (seq !== presetLoadSeq) return

    const newTrack: SavedTrack = {
      id: generateId(),
      name: preset.name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      objectCount: preset.objects.length,
      objects: cloneObjects(preset.objects),
      presetId,
      heightmap: sidecar ? sidecar.heightmap : undefined,
      heightmapSource: sidecar ? 'sidecar' : 'none',
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
    if (sidecar) {
      useTerrainStore.getState().loadHeightmap(sidecar.heightmap)
    } else {
      useTerrainStore.getState().resetHeightmap()
    }
    const center = getTrackCenter(newTrack.objects)
    if (center) {
      useEditorStore.getState().setCameraTarget(center)
    }

    debouncedSaveLibrary(() => get().saveLibrary())
  },

  saveCurrentTrack: () => {
    const state = get()
    if (state.isReadOnlyMigrationShim) return
    const activeId = state.trackLibrary.activeTrackId

    if (!activeId) {
      get().createTrack('My Track')
      return
    }

    const objects = useCustomizationStore.getState().placedObjects
    const terrainState = useTerrainStore.getState()
    const activeTrack = state.trackLibrary.tracks.find(t => t.id === activeId)
    const previousSource = activeTrack?.heightmapSource
    const hasTerrainData =
      terrainState.heightmap.length > 0 &&
      previousSource !== undefined &&
      previousSource !== 'none'
    const heightmap = hasTerrainData ? terrainState.getHeightsArray() : undefined

    let nextSource: HeightmapSource
    if (!hasTerrainData) {
      nextSource = 'none'
    } else if (state.isDirty && previousSource === 'sidecar') {
      nextSource = 'user'
    } else {
      nextSource = previousSource ?? 'user'
    }

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
                heightmapSource: nextSource,
              }
            : t,
        ),
      },
      isDirty: false,
    }))

    void get().saveLibrary()
  },

  exportCurrentTrack: () => {
    const t = get().getActiveTrack()
    if (!t) return
    const liveHeightmap = useTerrainStore.getState().getHeightsArray()
    exportTrack(t, { liveHeightmap })
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

  loadLibrary: async () => {
    if (get().isLoading || get().loadedOnce) return

    set({ isLoading: true })

    const stripDefaultTrack = (
      lib: TrackLibrary,
    ): { library: TrackLibrary; mutated: boolean } => {
      const filtered = lib.tracks.filter(t => t.id !== DEFAULT_TRACK_ID)
      if (filtered.length === lib.tracks.length) return { library: lib, mutated: false }
      const activeTrackId =
        lib.activeTrackId === DEFAULT_TRACK_ID
          ? (filtered[0]?.id ?? null)
          : lib.activeTrackId
      return { library: { ...lib, tracks: filtered, activeTrackId }, mutated: true }
    }

    const reconcilePresets = (
      lib: TrackLibrary,
    ): { library: TrackLibrary; mutated: boolean } => {
      let mutated = false
      const tracks = lib.tracks.map(t => {
        if (!t.presetId) return t
        const preset = getPresetTrack(t.presetId)
        if (!preset) return t
        if (presetObjectsEqual(t.objects, preset.objects)) return t
        mutated = true
        return {
          ...t,
          name: preset.name,
          updatedAt: Date.now(),
          objectCount: preset.objects.length,
          objects: cloneObjects(preset.objects),
        }
      })
      return { library: mutated ? { ...lib, tracks } : lib, mutated }
    }

    const finalize = (library: TrackLibrary, mutated: boolean) => {
      set({ trackLibrary: library, isLoading: false, loadedOnce: true })

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

      if (mutated) void get().saveLibrary()
    }

    try {
      const fromIdb = await readLibrary()
      if (fromIdb.isReadOnlyMigrationShim) {
        set({ isReadOnlyMigrationShim: true, migrationError: fromIdb.migrationError })
      }
      if (fromIdb.library) {
        const stripped = stripDefaultTrack(fromIdb.library)
        const reconciled = reconcilePresets(stripped.library)
        finalize(
          reconciled.library,
          (stripped.mutated || reconciled.mutated || fromIdb.migrationApplied) &&
            !fromIdb.isReadOnlyMigrationShim,
        )
        return
      }

      let migratedLib: TrackLibrary = {
        version: CURRENT_VERSION,
        activeTrackId: null,
        tracks: [],
      }
      let migratedFromLegacy = false

      const libraryData = localStorage.getItem(TRACK_LIBRARY_KEY)
      if (libraryData) {
        try {
          const parsed = JSON.parse(libraryData) as TrackLibrary
          migratedLib = {
            version: parsed.version ?? CURRENT_VERSION,
            activeTrackId: parsed.activeTrackId ?? null,
            tracks: Array.isArray(parsed.tracks) ? parsed.tracks : [],
          }
          migratedFromLegacy = true
        } catch (e) {
          console.error('Failed to parse legacy track library:', e)
        }
      }

      if (!migratedFromLegacy) {
        const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY)
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
            migratedLib = {
              version: CURRENT_VERSION,
              activeTrackId: migratedTrack.id,
              tracks: [migratedTrack],
            }
          } catch (e) {
            console.error('Failed to parse legacy track data:', e)
          }
        }
      }

      migratedLib = stripDefaultTrack(migratedLib).library
      migratedLib = reconcilePresets(migratedLib).library

      try {
        await writeLibrary(migratedLib)
        if (migratedFromLegacy) localStorage.removeItem(TRACK_LIBRARY_KEY)
      } catch (e) {
        console.error('Failed to migrate track library to IDB:', e)
      }

      finalize(migratedLib, false)
    } catch (e) {
      console.error('Failed to load track library:', e)
      set({ isLoading: false, loadedOnce: true })
    }
  },

  saveLibrary: () => {
    if (get().isReadOnlyMigrationShim) return Promise.resolve()
    if (saveInFlight) {
      savePending = true
      return saveInFlight
    }
    const snapshot = get().trackLibrary
    if (snapshot === lastWrittenLibrary) return Promise.resolve()
    const run = (async () => {
      try {
        await writeLibrary(snapshot)
        lastWrittenLibrary = snapshot
      } catch (e) {
        console.error('Failed to save track library:', e)
      }
    })()
    saveInFlight = run
    return run.finally(() => {
      saveInFlight = null
      if (savePending) {
        savePending = false
        void get().saveLibrary()
      }
    })
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
