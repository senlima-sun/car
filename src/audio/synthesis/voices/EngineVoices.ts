import { LoopVoice } from '../SynthVoice'
import { brownNoise, createNoiseSource } from '../NoiseGenerator'

export class EngineIdleVoice extends LoopVoice {
  private osc!: OscillatorNode
  private osc2!: OscillatorNode
  private filter!: BiquadFilterNode
  private lfo!: OscillatorNode
  private lfoGain!: GainNode

  protected startNodes(): void {
    this.osc = this.ctx.createOscillator()
    this.osc.type = 'sawtooth'
    this.osc.frequency.value = 80

    this.osc2 = this.ctx.createOscillator()
    this.osc2.type = 'sawtooth'
    this.osc2.frequency.value = 160

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.frequency.value = 400
    this.filter.Q.value = 1

    this.lfo = this.ctx.createOscillator()
    this.lfo.frequency.value = 2
    this.lfoGain = this.ctx.createGain()
    this.lfoGain.gain.value = 0.15

    this.lfo.connect(this.lfoGain)
    this.lfoGain.connect(this.output.gain)

    const mix = this.ctx.createGain()
    mix.gain.value = 0.5
    this.osc.connect(this.filter)
    this.osc2.connect(mix)
    mix.connect(this.filter)
    this.filter.connect(this.output)

    this.osc.start()
    this.osc2.start()
    this.lfo.start()
  }

  protected stopNodes(): void {
    this.osc.stop()
    this.osc2.stop()
    this.lfo.stop()
  }

  setRate(rate: number): void {
    if (!this.started) return
    const freq = 80 * rate
    this.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.01)
    this.osc2.frequency.setTargetAtTime(freq * 2, this.ctx.currentTime, 0.01)
  }
}

export class EngineLowVoice extends LoopVoice {
  private osc!: OscillatorNode
  private filter!: BiquadFilterNode

  protected startNodes(): void {
    this.osc = this.ctx.createOscillator()
    this.osc.type = 'sawtooth'
    this.osc.frequency.value = 150

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'bandpass'
    this.filter.frequency.value = 400
    this.filter.Q.value = 1.5

    this.osc.connect(this.filter)
    this.filter.connect(this.output)
    this.osc.start()
  }

  protected stopNodes(): void {
    this.osc.stop()
  }

  setRate(rate: number): void {
    if (!this.started) return
    this.osc.frequency.setTargetAtTime(150 * rate, this.ctx.currentTime, 0.01)
    this.filter.frequency.setTargetAtTime(400 * rate, this.ctx.currentTime, 0.01)
  }
}

export class EngineMidVoice extends LoopVoice {
  private osc!: OscillatorNode
  private filter!: BiquadFilterNode

  protected startNodes(): void {
    this.osc = this.ctx.createOscillator()
    this.osc.type = 'sawtooth'
    this.osc.frequency.value = 300

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'bandpass'
    this.filter.frequency.value = 600
    this.filter.Q.value = 1

    this.osc.connect(this.filter)
    this.filter.connect(this.output)
    this.osc.start()
  }

  protected stopNodes(): void {
    this.osc.stop()
  }

  setRate(rate: number): void {
    if (!this.started) return
    this.osc.frequency.setTargetAtTime(300 * rate, this.ctx.currentTime, 0.01)
    this.filter.frequency.setTargetAtTime(600 * rate, this.ctx.currentTime, 0.01)
  }
}

export class EngineHighVoice extends LoopVoice {
  private osc!: OscillatorNode
  private osc2!: OscillatorNode
  private filter!: BiquadFilterNode

  protected startNodes(): void {
    this.osc = this.ctx.createOscillator()
    this.osc.type = 'sawtooth'
    this.osc.frequency.value = 500

    this.osc2 = this.ctx.createOscillator()
    this.osc2.type = 'square'
    this.osc2.frequency.value = 500

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'highpass'
    this.filter.frequency.value = 400
    this.filter.Q.value = 0.7

    const blend = this.ctx.createGain()
    blend.gain.value = 0.3
    this.osc2.connect(blend)

    this.osc.connect(this.filter)
    blend.connect(this.filter)
    this.filter.connect(this.output)

    this.osc.start()
    this.osc2.start()
  }

  protected stopNodes(): void {
    this.osc.stop()
    this.osc2.stop()
  }

  setRate(rate: number): void {
    if (!this.started) return
    const freq = 500 * rate
    this.osc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.01)
    this.osc2.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.01)
  }
}

export class EngineDecelVoice extends LoopVoice {
  private osc!: OscillatorNode
  private noiseSource!: AudioBufferSourceNode
  private filter!: BiquadFilterNode

  protected startNodes(): void {
    this.osc = this.ctx.createOscillator()
    this.osc.type = 'sawtooth'
    this.osc.frequency.value = 100

    this.noiseSource = createNoiseSource(this.ctx, brownNoise(this.ctx))

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'bandpass'
    this.filter.frequency.value = 180
    this.filter.Q.value = 1

    const noiseMix = this.ctx.createGain()
    noiseMix.gain.value = 0.4
    this.noiseSource.connect(noiseMix)

    this.osc.connect(this.filter)
    noiseMix.connect(this.filter)
    this.filter.connect(this.output)

    this.osc.start()
    this.noiseSource.start()
  }

  protected stopNodes(): void {
    this.osc.stop()
    this.noiseSource.stop()
  }

  setRate(rate: number): void {
    if (!this.started) return
    this.osc.frequency.setTargetAtTime(100 * rate, this.ctx.currentTime, 0.01)
    this.filter.frequency.setTargetAtTime(180 * rate, this.ctx.currentTime, 0.01)
  }
}
