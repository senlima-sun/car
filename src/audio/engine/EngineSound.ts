import type { AudioManager } from '@/audio/AudioManager'

interface EngineLayer {
  id: string
  minRpm: number
  maxRpm: number
  baseRate: number
}

const OVERLAP_RPM = 500

const ENGINE_LAYERS: EngineLayer[] = [
  { id: 'engine-idle', minRpm: 0, maxRpm: 2000, baseRate: 0.5 },
  { id: 'engine-low', minRpm: 1500, maxRpm: 4000, baseRate: 0.7 },
  { id: 'engine-mid', minRpm: 3500, maxRpm: 7000, baseRate: 1.0 },
  { id: 'engine-high', minRpm: 6500, maxRpm: 9000, baseRate: 1.2 },
]

const ENGINE_BRAKING_VOLUME: Record<string, number> = {
  Low: 0.3,
  Medium: 0.6,
  High: 0.9,
}

export class EngineSound {
  private audioManager: AudioManager
  private layers: EngineLayer[]
  private currentRpm = 0
  private currentGear = 1
  private previousGear = 1
  private isActive = false

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
    this.layers = ENGINE_LAYERS
  }

  registerSounds(): void {
    this.audioManager.registerSound('engine-idle', {
      src: '/audio/engine/idle.mp3',
      category: 'engine',
      loop: true,
      volume: 0,
    })

    this.audioManager.registerSound('engine-low', {
      src: '/audio/engine/low.mp3',
      category: 'engine',
      loop: true,
      volume: 0,
    })

    this.audioManager.registerSound('engine-mid', {
      src: '/audio/engine/mid.mp3',
      category: 'engine',
      loop: true,
      volume: 0,
    })

    this.audioManager.registerSound('engine-high', {
      src: '/audio/engine/high.mp3',
      category: 'engine',
      loop: true,
      volume: 0,
    })

    this.audioManager.registerSound('engine-shift', {
      src: '/audio/engine/shift.mp3',
      category: 'engine',
      volume: 0.6,
    })

    this.audioManager.registerSound('engine-decel', {
      src: '/audio/engine/decel.mp3',
      category: 'engine',
      loop: true,
      volume: 0,
    })
  }

  start(): void {
    if (this.isActive) return
    this.isActive = true

    for (const layer of this.layers) {
      this.audioManager.playLoop(layer.id)
      this.audioManager.setLoopVolume(layer.id, 0)
    }

    this.audioManager.playLoop('engine-decel')
    this.audioManager.setLoopVolume('engine-decel', 0)

    this.updateRPM(800)
  }

  stop(): void {
    if (!this.isActive) return
    this.isActive = false

    for (const layer of this.layers) {
      this.audioManager.stopLoop(layer.id)
    }

    this.audioManager.stopLoop('engine-decel')
  }

  updateRPM(rpm: number): void {
    if (!this.isActive) return
    this.currentRpm = rpm

    for (const layer of this.layers) {
      const volume = this.computeLayerVolume(rpm, layer.minRpm, layer.maxRpm)
      const rate = this.computeLayerRate(rpm, layer.minRpm, layer.maxRpm, layer.baseRate)

      this.audioManager.setLoopVolume(layer.id, volume)
      this.audioManager.setLoopRate(layer.id, rate)
    }
  }

  updateGear(gear: number): void {
    if (!this.isActive) return
    this.previousGear = this.currentGear
    this.currentGear = gear

    if (this.previousGear !== this.currentGear) {
      this.audioManager.play('engine-shift')
    }
  }

  updateEngineBraking(level: 'Low' | 'Medium' | 'High'): void {
    if (!this.isActive) return

    const targetVolume = ENGINE_BRAKING_VOLUME[level] ?? 0.3
    this.audioManager.setLoopVolume('engine-decel', targetVolume)

    const rpmFactor = Math.min(this.currentRpm / 9000, 1)
    const decelRate = 0.7 + 0.5 * rpmFactor
    this.audioManager.setLoopRate('engine-decel', decelRate)
  }

  private computeLayerVolume(rpm: number, minRpm: number, maxRpm: number): number {
    if (rpm < minRpm || rpm > maxRpm) return 0

    const fadeInEnd = minRpm + OVERLAP_RPM
    const fadeOutStart = maxRpm - OVERLAP_RPM

    if (rpm < fadeInEnd) {
      return (rpm - minRpm) / OVERLAP_RPM
    }

    if (rpm > fadeOutStart) {
      return (maxRpm - rpm) / OVERLAP_RPM
    }

    return 1
  }

  private computeLayerRate(
    rpm: number,
    minRpm: number,
    maxRpm: number,
    baseRate: number
  ): number {
    const clamped = Math.max(minRpm, Math.min(maxRpm, rpm))
    const normalizedPosition = (clamped - minRpm) / (maxRpm - minRpm || 1)
    return baseRate * (0.8 + 0.4 * normalizedPosition)
  }
}
