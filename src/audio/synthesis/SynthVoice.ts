export interface SynthVoice {
  isLoop: boolean
  start(dest: AudioNode, volume: number): void
  stop(): void
  setVolume(v: number): void
  setRate(rate: number): void
  dispose(): void
}

export abstract class LoopVoice implements SynthVoice {
  readonly isLoop = true
  protected ctx: AudioContext
  protected output: GainNode
  protected started = false

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.output = ctx.createGain()
    this.output.gain.value = 0
  }

  start(dest: AudioNode, volume: number): void {
    if (this.started) return
    this.started = true
    this.output.connect(dest)
    this.output.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.01)
    this.startNodes()
  }

  stop(): void {
    if (!this.started) return
    this.started = false
    this.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01)
    setTimeout(() => {
      this.stopNodes()
      try { this.output.disconnect() } catch {}
    }, 50)
  }

  setVolume(v: number): void {
    if (!this.started) return
    this.output.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01)
  }

  setRate(_rate: number): void {}

  dispose(): void {
    this.stop()
  }

  protected abstract startNodes(): void
  protected abstract stopNodes(): void
}

export abstract class OneShotVoice implements SynthVoice {
  readonly isLoop = false
  protected ctx: AudioContext

  constructor(ctx: AudioContext) {
    this.ctx = ctx
  }

  start(dest: AudioNode, volume: number): void {
    this.playOneShot(dest, volume)
  }

  stop(): void {}
  setVolume(_v: number): void {}
  setRate(_rate: number): void {}
  dispose(): void {}

  protected abstract playOneShot(dest: AudioNode, volume: number): void
}
