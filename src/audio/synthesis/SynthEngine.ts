import type { SynthVoice } from './SynthVoice'
import type { SoundCategory } from '../types'

type VoiceFactory = (ctx: AudioContext) => SynthVoice

interface ActiveLoop {
  voice: SynthVoice
  category: SoundCategory
}

export class SynthEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private voiceFactories = new Map<string, { factory: VoiceFactory; category: SoundCategory }>()
  private activeLoops = new Map<string, ActiveLoop>()

  async init(): Promise<AudioContext> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume()
      }
      return this.ctx
    }

    this.ctx = new AudioContext()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 1
    this.masterGain.connect(this.ctx.destination)

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }

    return this.ctx
  }

  registerVoice(id: string, category: SoundCategory, factory: VoiceFactory): void {
    this.voiceFactories.set(id, { factory, category })
  }

  play(id: string, volume: number): void {
    if (!this.ctx || !this.masterGain) return
    const entry = this.voiceFactories.get(id)
    if (!entry) return

    const voice = entry.factory(this.ctx)
    voice.start(this.masterGain, volume)

    if (!voice.isLoop) {
      setTimeout(() => voice.dispose(), 3000)
    }
  }

  playLoop(id: string, volume: number): void {
    if (!this.ctx || !this.masterGain) return

    const existing = this.activeLoops.get(id)
    if (existing) {
      existing.voice.setVolume(volume)
      return
    }

    const entry = this.voiceFactories.get(id)
    if (!entry) return

    const voice = entry.factory(this.ctx)
    voice.start(this.masterGain, volume)
    this.activeLoops.set(id, { voice, category: entry.category })
  }

  stopLoop(id: string): void {
    const loop = this.activeLoops.get(id)
    if (!loop) return

    loop.voice.stop()
    this.activeLoops.delete(id)
  }

  setLoopVolume(id: string, v: number): void {
    const loop = this.activeLoops.get(id)
    if (!loop) return

    loop.voice.setVolume(v)
  }

  setLoopRate(id: string, rate: number): void {
    const loop = this.activeLoops.get(id)
    if (!loop) return

    loop.voice.setRate(rate)
  }

  dispose(): void {
    for (const [id] of this.activeLoops) {
      this.stopLoop(id)
    }
    this.activeLoops.clear()

    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close()
    }

    this.masterGain = null
    this.ctx = null
  }
}
