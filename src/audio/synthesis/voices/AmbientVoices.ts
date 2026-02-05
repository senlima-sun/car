import { LoopVoice } from '../SynthVoice'
import { brownNoise, whiteNoise, pinkNoise, createNoiseSource } from '../NoiseGenerator'

export class WindVoice extends LoopVoice {
  private source!: AudioBufferSourceNode
  private filter!: BiquadFilterNode

  protected startNodes(): void {
    this.source = createNoiseSource(this.ctx, brownNoise(this.ctx))

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 500
    this.filter.Q.value = 0.5

    this.source.connect(this.filter)
    this.filter.connect(this.output)
    this.source.start()
  }

  protected stopNodes(): void {
    this.source.stop()
  }

  setRate(rate: number): void {
    if (!this.started) return
    const cutoff = 300 + rate * 400
    this.filter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.01)
  }
}

export class RainVoice extends LoopVoice {
  private source!: AudioBufferSourceNode
  private lowFilter!: BiquadFilterNode
  private highFilter!: BiquadFilterNode

  protected startNodes(): void {
    this.source = createNoiseSource(this.ctx, whiteNoise(this.ctx))

    this.highFilter = this.ctx.createBiquadFilter()
    this.highFilter.type = 'highpass'
    this.highFilter.frequency.value = 1000
    this.highFilter.Q.value = 0.5

    this.lowFilter = this.ctx.createBiquadFilter()
    this.lowFilter.type = 'lowpass'
    this.lowFilter.frequency.value = 8000
    this.lowFilter.Q.value = 0.5

    this.source.connect(this.highFilter)
    this.highFilter.connect(this.lowFilter)
    this.lowFilter.connect(this.output)
    this.source.start()
  }

  protected stopNodes(): void {
    this.source.stop()
  }
}

export class AquaplaningVoice extends LoopVoice {
  private source!: AudioBufferSourceNode
  private lowFilter!: BiquadFilterNode
  private highFilter!: BiquadFilterNode
  private lfo!: OscillatorNode
  private lfoGain!: GainNode

  protected startNodes(): void {
    this.source = createNoiseSource(this.ctx, pinkNoise(this.ctx))

    this.highFilter = this.ctx.createBiquadFilter()
    this.highFilter.type = 'highpass'
    this.highFilter.frequency.value = 500
    this.highFilter.Q.value = 0.7

    this.lowFilter = this.ctx.createBiquadFilter()
    this.lowFilter.type = 'lowpass'
    this.lowFilter.frequency.value = 3000
    this.lowFilter.Q.value = 0.7

    this.lfo = this.ctx.createOscillator()
    this.lfo.frequency.value = 5
    this.lfoGain = this.ctx.createGain()
    this.lfoGain.gain.value = 0.3

    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.output.gain)

    this.source.connect(this.highFilter)
    this.highFilter.connect(this.lowFilter)
    this.lowFilter.connect(this.output)

    this.source.start()
    this.lfo.start()
  }

  protected stopNodes(): void {
    this.source.stop()
    this.lfo.stop()
  }
}
