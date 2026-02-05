import { SynthEngine, registerAllVoices } from './synthesis'
import type { SoundCategory, SoundConfig, FrameAudioParams, VolumeConfig } from './types'

interface SoundEntry {
  config: SoundConfig
}

interface LoopEntry {
  category: SoundCategory
  baseVolume: number
}

export class AudioManager {
  private static instance: AudioManager | null = null

  private synthEngine = new SynthEngine()
  private sounds = new Map<string, SoundEntry>()
  private loops = new Map<string, LoopEntry>()
  private volumeConfig: VolumeConfig = {
    master: 0.8,
    engine: 0.7,
    effects: 0.7,
    ui: 0.5,
    music: 0.3,
  }
  private muted = false
  private frameCount = 0
  private _initialized = false

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager()
    }
    return AudioManager.instance
  }

  static destroyInstance(): void {
    if (AudioManager.instance) {
      AudioManager.instance.dispose()
      AudioManager.instance = null
    }
  }

  async init(): Promise<void> {
    if (this._initialized) return

    await this.synthEngine.init()
    registerAllVoices(this.synthEngine)
    this._initialized = true
  }

  get initialized(): boolean {
    return this._initialized
  }

  setMasterVolume(v: number): void {
    this.volumeConfig.master = Math.max(0, Math.min(1, v))
    this.syncAllLoopVolumes()
  }

  setCategoryVolume(category: SoundCategory, v: number): void {
    this.volumeConfig[category] = Math.max(0, Math.min(1, v))
    this.syncAllLoopVolumes()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.syncAllLoopVolumes()
  }

  updateVolumeConfig(config: Partial<VolumeConfig> & { muted?: boolean }): void {
    if (config.master !== undefined) this.volumeConfig.master = config.master
    if (config.engine !== undefined) this.volumeConfig.engine = config.engine
    if (config.effects !== undefined) this.volumeConfig.effects = config.effects
    if (config.ui !== undefined) this.volumeConfig.ui = config.ui
    if (config.music !== undefined) this.volumeConfig.music = config.music
    if (config.muted !== undefined) this.muted = config.muted

    this.syncAllLoopVolumes()
  }

  registerSound(id: string, config: SoundConfig): void {
    this.sounds.set(id, { config })
  }

  play(id: string): void {
    const entry = this.sounds.get(id)
    if (!entry) return

    const effectiveVolume = this.computeEffectiveVolume(
      entry.config.category,
      entry.config.volume ?? 1
    )
    this.synthEngine.play(id, effectiveVolume)
  }

  playLoop(id: string): void {
    const existing = this.loops.get(id)
    if (existing) return

    const entry = this.sounds.get(id)
    if (!entry) return

    const baseVolume = entry.config.volume ?? 1
    const effectiveVolume = this.computeEffectiveVolume(entry.config.category, baseVolume)

    this.synthEngine.playLoop(id, effectiveVolume)

    this.loops.set(id, {
      category: entry.config.category,
      baseVolume,
    })
  }

  stopLoop(id: string): void {
    const loop = this.loops.get(id)
    if (!loop) return

    this.synthEngine.stopLoop(id)
    this.loops.delete(id)
  }

  setLoopVolume(id: string, v: number): void {
    const loop = this.loops.get(id)
    if (!loop) return

    loop.baseVolume = Math.max(0, Math.min(1, v))
    const effectiveVolume = this.computeEffectiveVolume(loop.category, loop.baseVolume)
    this.synthEngine.setLoopVolume(id, effectiveVolume)
  }

  setLoopRate(id: string, rate: number): void {
    const loop = this.loops.get(id)
    if (!loop) return

    this.synthEngine.setLoopRate(id, Math.max(0.1, Math.min(4, rate)))
  }

  updatePerFrame(_params: FrameAudioParams): void {
    this.frameCount++

    if (this.frameCount % 4 === 0) {
      this.syncAllLoopVolumes()
    }
  }

  dispose(): void {
    for (const [id] of this.loops) {
      this.synthEngine.stopLoop(id)
    }
    this.loops.clear()
    this.sounds.clear()
    this.synthEngine.dispose()
    this._initialized = false
  }

  private computeEffectiveVolume(category: SoundCategory, baseVolume: number): number {
    if (this.muted) return 0
    return baseVolume * this.volumeConfig[category] * this.volumeConfig.master
  }

  private syncAllLoopVolumes(): void {
    for (const [id, loop] of this.loops) {
      const effectiveVolume = this.computeEffectiveVolume(loop.category, loop.baseVolume)
      this.synthEngine.setLoopVolume(id, effectiveVolume)
    }
  }
}
