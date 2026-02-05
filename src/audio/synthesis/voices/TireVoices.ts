import { LoopVoice } from '../SynthVoice'
import { whiteNoise, brownNoise, createNoiseSource } from '../NoiseGenerator'

export class TireScreechVoice extends LoopVoice {
  private source!: AudioBufferSourceNode
  private filter!: BiquadFilterNode

  protected startNodes(): void {
    this.source = createNoiseSource(this.ctx, whiteNoise(this.ctx))

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'highpass'
    this.filter.frequency.value = 3000
    this.filter.Q.value = 2

    this.source.connect(this.filter)
    this.filter.connect(this.output)
    this.source.start()
  }

  protected stopNodes(): void {
    this.source.stop()
  }
}

export class GrassRollVoice extends LoopVoice {
  private source!: AudioBufferSourceNode
  private filter!: BiquadFilterNode

  protected startNodes(): void {
    this.source = createNoiseSource(this.ctx, brownNoise(this.ctx))

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 800
    this.filter.Q.value = 0.7

    this.source.connect(this.filter)
    this.filter.connect(this.output)
    this.source.start()
  }

  protected stopNodes(): void {
    this.source.stop()
  }
}

export class CurbRattleVoice extends LoopVoice {
  private source!: AudioBufferSourceNode
  private filter!: BiquadFilterNode
  private lfo!: OscillatorNode
  private lfoGain!: GainNode

  protected startNodes(): void {
    this.source = createNoiseSource(this.ctx, whiteNoise(this.ctx))

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'bandpass'
    this.filter.frequency.value = 1500
    this.filter.Q.value = 4

    this.lfo = this.ctx.createOscillator()
    this.lfo.frequency.value = 15
    this.lfoGain = this.ctx.createGain()
    this.lfoGain.gain.value = 0.4

    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.output.gain)

    this.source.connect(this.filter)
    this.filter.connect(this.output)

    this.source.start()
    this.lfo.start()
  }

  protected stopNodes(): void {
    this.source.stop()
    this.lfo.stop()
  }
}
