import { Howl, Howler } from 'howler'
import type { SoundCategory, SoundConfig, FrameAudioParams, VolumeConfig } from './types'

interface LoopEntry {
  howl: Howl
  category: SoundCategory
  baseVolume: number
}

export class AudioManager {
  private static instance: AudioManager | null = null

  private sounds = new Map<string, { howl: Howl; config: SoundConfig }>()
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

    const ctx = Howler.ctx
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume()
    }

    Howler.volume(this.computeMasterVolume())
    this._initialized = true
  }

  get initialized(): boolean {
    return this._initialized
  }

  setMasterVolume(v: number): void {
    this.volumeConfig.master = Math.max(0, Math.min(1, v))
    this.syncGlobalVolume()
    this.syncAllLoopVolumes()
  }

  setCategoryVolume(category: SoundCategory, v: number): void {
    this.volumeConfig[category] = Math.max(0, Math.min(1, v))
    this.syncAllLoopVolumes()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.syncGlobalVolume()
    this.syncAllLoopVolumes()
  }

  updateVolumeConfig(config: Partial<VolumeConfig> & { muted?: boolean }): void {
    if (config.master !== undefined) this.volumeConfig.master = config.master
    if (config.engine !== undefined) this.volumeConfig.engine = config.engine
    if (config.effects !== undefined) this.volumeConfig.effects = config.effects
    if (config.ui !== undefined) this.volumeConfig.ui = config.ui
    if (config.music !== undefined) this.volumeConfig.music = config.music
    if (config.muted !== undefined) this.muted = config.muted

    this.syncGlobalVolume()
    this.syncAllLoopVolumes()
  }

  registerSound(id: string, config: SoundConfig): void {
    if (this.sounds.has(id)) {
      this.sounds.get(id)!.howl.unload()
    }

    const howl = new Howl({
      src: Array.isArray(config.src) ? config.src : [config.src],
      loop: config.loop ?? false,
      volume: config.volume ?? 1,
      rate: config.rate ?? 1,
      sprite: config.sprite as unknown as Record<string, [number, number] | [number, number, boolean]> | undefined,
      preload: true,
    })

    this.sounds.set(id, { howl, config })
  }

  play(id: string): void {
    const entry = this.sounds.get(id)
    if (!entry) return

    const effectiveVolume = this.computeEffectiveVolume(
      entry.config.category,
      entry.config.volume ?? 1
    )
    entry.howl.volume(effectiveVolume)
    entry.howl.play()
  }

  playLoop(id: string): Howl {
    const existing = this.loops.get(id)
    if (existing) {
      if (!existing.howl.playing()) {
        existing.howl.play()
      }
      return existing.howl
    }

    const entry = this.sounds.get(id)
    if (!entry) {
      throw new Error(`Sound "${id}" not registered. Call registerSound first.`)
    }

    const baseVolume = entry.config.volume ?? 1
    const effectiveVolume = this.computeEffectiveVolume(entry.config.category, baseVolume)

    entry.howl.loop(true)
    entry.howl.volume(effectiveVolume)
    entry.howl.play()

    this.loops.set(id, {
      howl: entry.howl,
      category: entry.config.category,
      baseVolume,
    })

    return entry.howl
  }

  stopLoop(id: string): void {
    const loop = this.loops.get(id)
    if (!loop) return

    loop.howl.stop()
    this.loops.delete(id)
  }

  setLoopVolume(id: string, v: number): void {
    const loop = this.loops.get(id)
    if (!loop) return

    loop.baseVolume = Math.max(0, Math.min(1, v))
    const effectiveVolume = this.computeEffectiveVolume(loop.category, loop.baseVolume)
    loop.howl.volume(effectiveVolume)
  }

  setLoopRate(id: string, rate: number): void {
    const loop = this.loops.get(id)
    if (!loop) return

    loop.howl.rate(Math.max(0.1, Math.min(4, rate)))
  }

  updatePerFrame(_params: FrameAudioParams): void {
    this.frameCount++

    if (this.frameCount % 4 === 0) {
      this.updateThrottled()
    }
  }

  dispose(): void {
    for (const [, loop] of this.loops) {
      loop.howl.stop()
    }
    this.loops.clear()

    for (const [, entry] of this.sounds) {
      entry.howl.unload()
    }
    this.sounds.clear()

    this._initialized = false
  }

  private updateThrottled(): void {
    this.syncAllLoopVolumes()
  }

  private computeMasterVolume(): number {
    return this.muted ? 0 : this.volumeConfig.master
  }

  private computeEffectiveVolume(category: SoundCategory, baseVolume: number): number {
    if (this.muted) return 0
    return baseVolume * this.volumeConfig[category] * this.volumeConfig.master
  }

  private syncGlobalVolume(): void {
    Howler.volume(this.computeMasterVolume())
  }

  private syncAllLoopVolumes(): void {
    for (const [, loop] of this.loops) {
      const effectiveVolume = this.computeEffectiveVolume(loop.category, loop.baseVolume)
      loop.howl.volume(effectiveVolume)
    }
  }
}
