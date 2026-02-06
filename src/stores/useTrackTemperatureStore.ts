import { create } from 'zustand'
import * as THREE from 'three'

// Grid cell data
export interface GridCell {
  temperature: number // 0-1: cold to hot (from car driving)
  wetness: number // 0-1: dry to wet (rain accumulation)
  waterDepth?: number // 0-1: standing water depth (from WASM physics)
  rainExposure?: number // 0-1: 0 = sheltered, 1 = open sky
  drainageRate?: number // Slope-based drainage speed
  isRoad?: boolean // Whether this cell is a road surface (retains heat better)
  lastUpdated: number // timestamp for decay calculations
}

// Configuration
export const TRACK_TEMP_CONFIG = {
  gridSize: 2, // World units per cell (meters)
  worldBounds: {
    minX: -250,
    maxX: 250,
    minZ: -250,
    maxZ: 250,
  },
  textureSize: 512, // DataTexture resolution
  maxTrackedCells: 5000, // Prune oldest beyond this
  cellPruneInterval: 5, // Seconds between prune checks

  // Temperature behavior
  heatGainRate: 3.0, // How fast temperature rises when car drives over (increased for visibility)
  heatRadius: 4, // Affect cells within this radius of car

  // Base decay rate per second - matched to Rust physics engine
  baseDecayRate: 0.004, // Track cools slowly in normal conditions
  coldDecayMultiplier: 4.5, // Cold weather cools faster (< 5°C)
  hotDecayMultiplier: 0.5, // Hot weather keeps track warm (> 35°C)
  rainDecayMultiplier: 3.0, // Rain cools track faster

  // Road surface thermal properties (asphalt retains heat better)
  roadDecayMultiplier: 0.3, // Roads lose heat 70% slower than grass
  roadRainDecayMultiplier: 2.5, // Rain accelerates road cooling (water conducts heat)

  // Wetness behavior
  wetnessGainRate: 0.1, // How fast wetness accumulates in rain
  wetnessDryRate: 0.5, // How fast car dries the track
  wetnessDecayRate: 0.02, // How fast wetness naturally evaporates
}

interface TrackTemperatureState {
  cells: Map<string, GridCell>
  cellsVersion: number

  dataTexture: THREE.DataTexture | null
  textureNeedsUpdate: boolean

  lastPruneTime: number

  updateCarPosition: (x: number, z: number, delta: number, intensity?: number) => void
  updateWeatherEffects: (temperature: number, rainIntensity: number, delta: number) => void
  initializeTexture: () => void
  updateTexture: () => void
  getCell: (worldX: number, worldZ: number) => GridCell | undefined
  getCellKey: (worldX: number, worldZ: number) => string
  setRoadRegion: (minX: number, minZ: number, maxX: number, maxZ: number, isRoad: boolean) => void
}

// Helper to convert world position to cell key
function getCellKey(worldX: number, worldZ: number): string {
  const cellX = Math.floor(worldX / TRACK_TEMP_CONFIG.gridSize)
  const cellZ = Math.floor(worldZ / TRACK_TEMP_CONFIG.gridSize)
  return `${cellX},${cellZ}`
}

// Helper to convert cell key to grid coordinates
function keyToGrid(key: string): [number, number] {
  const [x, z] = key.split(',').map(Number)
  return [x, z]
}

// Helper to convert grid coordinates to texture UV
function gridToTextureCoord(cellX: number, cellZ: number): [number, number] {
  const { worldBounds, gridSize, textureSize } = TRACK_TEMP_CONFIG

  const u = Math.floor(
    ((cellX * gridSize - worldBounds.minX) / (worldBounds.maxX - worldBounds.minX)) * textureSize,
  )
  const v = Math.floor(
    ((cellZ * gridSize - worldBounds.minZ) / (worldBounds.maxZ - worldBounds.minZ)) * textureSize,
  )

  return [Math.max(0, Math.min(textureSize - 1, u)), Math.max(0, Math.min(textureSize - 1, v))]
}

export const useTrackTemperatureStore = create<TrackTemperatureState>((set, get) => ({
  cells: new Map(),
  cellsVersion: 0,
  dataTexture: null,
  textureNeedsUpdate: false,
  lastPruneTime: 0,

  getCellKey: (worldX: number, worldZ: number) => getCellKey(worldX, worldZ),

  getCell: (worldX: number, worldZ: number) => {
    const key = getCellKey(worldX, worldZ)
    return get().cells.get(key)
  },

  initializeTexture: () => {
    const { textureSize } = TRACK_TEMP_CONFIG
    // RGBA: R = temperature, G = wetness, B = reserved, A = 1
    const data = new Uint8Array(textureSize * textureSize * 4)

    // Initialize all pixels to default (no heat, no wetness)
    for (let i = 0; i < textureSize * textureSize; i++) {
      data[i * 4] = 0 // R: temperature
      data[i * 4 + 1] = 0 // G: wetness
      data[i * 4 + 2] = 0 // B: reserved
      data[i * 4 + 3] = 255 // A: alpha
    }

    const texture = new THREE.DataTexture(data, textureSize, textureSize, THREE.RGBAFormat)
    texture.needsUpdate = true
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearFilter
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping

    set({ dataTexture: texture })
  },

  updateTexture: () => {
    const { dataTexture, cells } = get()
    if (!dataTexture) return

    const { textureSize } = TRACK_TEMP_CONFIG
    const data = dataTexture.image.data as Uint8Array

    // Reset all pixels first
    for (let i = 0; i < textureSize * textureSize; i++) {
      data[i * 4] = 0
      data[i * 4 + 1] = 0
    }

    // Update pixels from cells
    cells.forEach((cell, key) => {
      const [cellX, cellZ] = keyToGrid(key)
      const [u, v] = gridToTextureCoord(cellX, cellZ)
      const idx = (v * textureSize + u) * 4

      data[idx] = Math.floor(cell.temperature * 255)
      data[idx + 1] = Math.floor(cell.wetness * 255)
    })

    dataTexture.needsUpdate = true
    set({ textureNeedsUpdate: false })
  },

  updateCarPosition: (x: number, z: number, delta: number, intensity: number = 0.1) => {
    const state = get()
    const { cells } = state
    const { gridSize, heatGainRate, heatRadius, wetnessDryRate } = TRACK_TEMP_CONFIG
    const now = performance.now() / 1000

    // Skip if intensity is too low (reduced threshold to allow normal driving updates)
    if (intensity < 0.01) {
      return
    }

    // Update cells within heat radius of car position
    const cellRadius = Math.ceil(heatRadius / gridSize)
    const centerCellX = Math.floor(x / gridSize)
    const centerCellZ = Math.floor(z / gridSize)

    for (let dx = -cellRadius; dx <= cellRadius; dx++) {
      for (let dz = -cellRadius; dz <= cellRadius; dz++) {
        const cellX = centerCellX + dx
        const cellZ = centerCellZ + dz

        // Calculate distance from car center
        const worldX = cellX * gridSize + gridSize / 2
        const worldZ = cellZ * gridSize + gridSize / 2
        const dist = Math.sqrt((worldX - x) ** 2 + (worldZ - z) ** 2)

        if (dist > heatRadius) continue

        // Heat falloff based on distance
        const falloff = 1 - dist / heatRadius
        const key = `${cellX},${cellZ}`

        let cell = cells.get(key)
        if (!cell) {
          cell = { temperature: 0, wetness: 0, lastUpdated: now }
          cells.set(key, cell)
        }

        // Increase temperature based on skid intensity (car heating the track)
        cell.temperature = Math.min(
          1,
          cell.temperature + heatGainRate * intensity * falloff * delta,
        )

        // Decrease wetness (car drying the track)
        cell.wetness = Math.max(0, cell.wetness - wetnessDryRate * falloff * delta)

        cell.lastUpdated = now
      }
    }

    set(s => ({ cellsVersion: s.cellsVersion + 1, textureNeedsUpdate: true }))
  },

  updateWeatherEffects: (temperature: number, rainIntensity: number, delta: number) => {
    const state = get()
    const { cells, lastPruneTime } = state
    const {
      baseDecayRate,
      coldDecayMultiplier,
      hotDecayMultiplier,
      rainDecayMultiplier,
      roadDecayMultiplier,
      roadRainDecayMultiplier,
      wetnessGainRate,
      wetnessDecayRate,
      maxTrackedCells,
      cellPruneInterval,
    } = TRACK_TEMP_CONFIG
    const now = performance.now() / 1000

    // Calculate decay rate from temperature
    let tempDecayRate = baseDecayRate
    if (temperature < 5) {
      // Cold: interpolate from normal to cold decay
      const t = Math.max(0, (temperature + 10) / 15) // -10°C -> 0, 5°C -> 1
      tempDecayRate = baseDecayRate * (coldDecayMultiplier - (coldDecayMultiplier - 1) * t)
    } else if (temperature > 35) {
      // Hot: interpolate from normal to hot decay
      const t = Math.min(1, (temperature - 35) / 15) // 35°C -> 0, 50°C -> 1
      tempDecayRate = baseDecayRate * (1 - (1 - hotDecayMultiplier) * t)
    }

    // Apply rain multiplier
    const weatherDecayRate = tempDecayRate * (1 + rainIntensity * (rainDecayMultiplier - 1))
    const isRaining = rainIntensity > 0.01

    // Update all tracked cells
    cells.forEach(cell => {
      // Calculate decay rate based on surface type
      // Roads retain heat better (lower decay) unless it's raining
      let decayRate = weatherDecayRate
      if (cell.isRoad) {
        if (isRaining) {
          // Rain accelerates cooling on roads (water conducts heat away)
          decayRate = weatherDecayRate * roadRainDecayMultiplier
        } else {
          // Roads retain heat much better in dry conditions
          decayRate = weatherDecayRate * roadDecayMultiplier
        }
      }

      // Temperature decay
      cell.temperature = Math.max(0, cell.temperature - decayRate * delta)

      // Wetness changes based on rain intensity
      if (isRaining) {
        // Rain adds wetness proportional to intensity
        cell.wetness = Math.min(1, cell.wetness + wetnessGainRate * rainIntensity * delta)
      } else {
        // Wetness evaporates
        cell.wetness = Math.max(0, cell.wetness - wetnessDecayRate * delta)
      }
    })

    // Prune cells that have returned to default state
    if (now - lastPruneTime > cellPruneInterval) {
      const cellsToDelete: string[] = []

      cells.forEach((cell, key) => {
        if (cell.temperature < 0.01 && cell.wetness < 0.01) {
          cellsToDelete.push(key)
        }
      })

      cellsToDelete.forEach(key => cells.delete(key))

      // If still over limit, prune oldest cells
      if (cells.size > maxTrackedCells) {
        const sortedEntries = Array.from(cells.entries()).sort(
          (a, b) => a[1].lastUpdated - b[1].lastUpdated,
        )

        const toRemove = cells.size - maxTrackedCells
        for (let i = 0; i < toRemove; i++) {
          cells.delete(sortedEntries[i][0])
        }
      }

      set({ lastPruneTime: now })
    }

    set(s => ({ cellsVersion: s.cellsVersion + 1, textureNeedsUpdate: true }))
  },

  setRoadRegion: (minX: number, minZ: number, maxX: number, maxZ: number, isRoad: boolean) => {
    const { cells } = get()
    const { gridSize } = TRACK_TEMP_CONFIG
    const now = performance.now() / 1000

    const startCellX = Math.floor(minX / gridSize)
    const startCellZ = Math.floor(minZ / gridSize)
    const endCellX = Math.floor(maxX / gridSize)
    const endCellZ = Math.floor(maxZ / gridSize)

    for (let cellX = startCellX; cellX <= endCellX; cellX++) {
      for (let cellZ = startCellZ; cellZ <= endCellZ; cellZ++) {
        const key = `${cellX},${cellZ}`
        let cell = cells.get(key)
        if (!cell) {
          cell = { temperature: 0, wetness: 0, isRoad, lastUpdated: now }
          cells.set(key, cell)
        } else {
          cell.isRoad = isRoad
        }
      }
    }

    set(s => ({ cellsVersion: s.cellsVersion + 1, textureNeedsUpdate: true }))
  },
}))
