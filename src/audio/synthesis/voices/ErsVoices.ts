import { LoopVoice, OneShotVoice } from '../SynthVoice'

export class ErsDeployVoice extends LoopVoice {
  private carrier!: OscillatorNode
  private modulator!: OscillatorNode
  private modGain!: GainNode

  protected startNodes(): void {
    this.carrier = this.ctx.createOscillator()
    this.carrier.type = 'sine'
    this.carrier.frequency.value = 400

    this.modulator = this.ctx.createOscillator()
    this.modulator.type = 'sine'
    this.modulator.frequency.value = 800

    this.modGain = this.ctx.createGain()
    this.modGain.gain.value = 400 * 3

    this.modulator.connect(this.modGain)
    this.modGain.connect(this.carrier.frequency)
    this.carrier.connect(this.output)

    this.carrier.start()
    this.modulator.start()
  }

  protected stopNodes(): void {
    this.carrier.stop()
    this.modulator.stop()
  }

  setRate(rate: number): void {
    if (!this.started) return
    const carrierFreq = 400 * rate
    this.carrier.frequency.setTargetAtTime(carrierFreq, this.ctx.currentTime, 0.01)
    this.modulator.frequency.setTargetAtTime(carrierFreq * 2, this.ctx.currentTime, 0.01)
    this.modGain.gain.setTargetAtTime(carrierFreq * 3, this.ctx.currentTime, 0.01)
  }
}

export class ErsHarvestVoice extends LoopVoice {
  private carrier!: OscillatorNode
  private modulator!: OscillatorNode
  private modGain!: GainNode

  protected startNodes(): void {
    this.carrier = this.ctx.createOscillator()
    this.carrier.type = 'sine'
    this.carrier.frequency.value = 250

    this.modulator = this.ctx.createOscillator()
    this.modulator.type = 'sine'
    this.modulator.frequency.value = 500

    this.modGain = this.ctx.createGain()
    this.modGain.gain.value = 250 * 2

    this.modulator.connect(this.modGain)
    this.modGain.connect(this.carrier.frequency)
    this.carrier.connect(this.output)

    this.carrier.start()
    this.modulator.start()
  }

  protected stopNodes(): void {
    this.carrier.stop()
    this.modulator.stop()
  }
}

export class ErsOvertakeVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, this.ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.3)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3)

    osc.connect(gain)
    gain.connect(dest)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.35)
  }
}

export class ErsBatteryCriticalVoice extends LoopVoice {
  private osc!: OscillatorNode
  private pulseGain!: GainNode
  private pulseLfo!: OscillatorNode

  protected startNodes(): void {
    this.osc = this.ctx.createOscillator()
    this.osc.type = 'square'
    this.osc.frequency.value = 440

    this.pulseLfo = this.ctx.createOscillator()
    this.pulseLfo.type = 'square'
    this.pulseLfo.frequency.value = 2

    this.pulseGain = this.ctx.createGain()
    this.pulseGain.gain.value = 0.5

    this.pulseLfo.connect(this.pulseGain)

    const gateGain = this.ctx.createGain()
    gateGain.gain.value = 0
    this.pulseGain.connect(gateGain.gain)

    this.osc.connect(gateGain)
    gateGain.connect(this.output)

    this.osc.start()
    this.pulseLfo.start()
  }

  protected stopNodes(): void {
    this.osc.stop()
    this.pulseLfo.stop()
  }
}
