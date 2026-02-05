import { LoopVoice, OneShotVoice } from '../SynthVoice'
import { whiteNoise, createNoiseSource } from '../NoiseGenerator'

export class EngineShiftVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const source = createNoiseSource(this.ctx, whiteNoise(this.ctx))

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 3000
    filter.Q.value = 2

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    source.start()
    source.stop(this.ctx.currentTime + 0.06)
  }
}

export class DriftVoice extends LoopVoice {
  private source!: AudioBufferSourceNode
  private filter!: BiquadFilterNode

  protected startNodes(): void {
    this.source = createNoiseSource(this.ctx, whiteNoise(this.ctx))

    this.filter = this.ctx.createBiquadFilter()
    this.filter.type = 'bandpass'
    this.filter.frequency.value = 1600
    this.filter.Q.value = 1.5

    this.source.connect(this.filter)
    this.filter.connect(this.output)
    this.source.start()
  }

  protected stopNodes(): void {
    this.source.stop()
  }
}

export class CollisionVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const source = createNoiseSource(this.ctx, whiteNoise(this.ctx))

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(5000, this.ctx.currentTime)
    filter.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.2)
    filter.Q.value = 1

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    source.start()
    source.stop(this.ctx.currentTime + 0.25)
  }
}

export class AeroToggleVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const source = createNoiseSource(this.ctx, whiteNoise(this.ctx))

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 4500
    filter.Q.value = 3

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    source.start()
    source.stop(this.ctx.currentTime + 0.04)
  }
}

export class UIClickVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 3000

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.015)

    osc.connect(gain)
    gain.connect(dest)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.02)
  }
}

export class UILapCompleteVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const notes = [523.25, 659.25, 783.99]
    const noteLen = 0.12

    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = notes[i]

      const gain = this.ctx.createGain()
      const start = this.ctx.currentTime + i * noteLen
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(volume, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteLen)

      osc.connect(gain)
      gain.connect(dest)
      osc.start(start)
      osc.stop(start + noteLen + 0.01)
    }
  }
}

export class UIBestLapVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    const noteLen = 0.14

    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = notes[i]

      const gain = this.ctx.createGain()
      const start = this.ctx.currentTime + i * noteLen
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(volume, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteLen)

      osc.connect(gain)
      gain.connect(dest)
      osc.start(start)
      osc.stop(start + noteLen + 0.01)
    }
  }
}

export class UIGearShiftVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const source = createNoiseSource(this.ctx, whiteNoise(this.ctx))

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 3000
    filter.Q.value = 2

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.02)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(dest)
    source.start()
    source.stop(this.ctx.currentTime + 0.025)
  }
}

export class UIPitCompleteVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = 2500

      const gain = this.ctx.createGain()
      const start = this.ctx.currentTime + i * 0.15
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(volume, start + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1)

      osc.connect(gain)
      gain.connect(dest)
      osc.start(start)
      osc.stop(start + 0.12)
    }
  }
}

export class UIModeToggleVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const freqs = [2000, 2500]
    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freqs[i]

      const gain = this.ctx.createGain()
      const start = this.ctx.currentTime + i * 0.06
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(volume, start + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.025)

      osc.connect(gain)
      gain.connect(dest)
      osc.start(start)
      osc.stop(start + 0.035)
    }
  }
}

export class CountdownBeepVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 800

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.setValueAtTime(volume, this.ctx.currentTime + 0.1)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15)

    osc.connect(gain)
    gain.connect(dest)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.18)
  }
}

export class CountdownGoVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 1200

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.setValueAtTime(volume, this.ctx.currentTime + 0.15)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2)

    osc.connect(gain)
    gain.connect(dest)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.25)
  }
}

export class GamePauseVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, this.ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.2)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2)

    osc.connect(gain)
    gain.connect(dest)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.25)
  }
}

export class GameResumeVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(300, this.ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.2)

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2)

    osc.connect(gain)
    gain.connect(dest)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.25)
  }
}

export class RaceFinishVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    const noteLen = 0.18

    for (let i = 0; i < notes.length; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = notes[i]

      const osc2 = this.ctx.createOscillator()
      osc2.type = 'triangle'
      osc2.frequency.value = notes[i]

      const blend = this.ctx.createGain()
      blend.gain.value = 0.3

      const gain = this.ctx.createGain()
      const start = this.ctx.currentTime + i * noteLen
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(volume, start + 0.01)
      gain.gain.setValueAtTime(volume * 0.8, start + noteLen * 0.7)
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteLen)

      osc.connect(gain)
      osc2.connect(blend)
      blend.connect(gain)
      gain.connect(dest)
      osc.start(start)
      osc2.start(start)
      osc.stop(start + noteLen + 0.01)
      osc2.stop(start + noteLen + 0.01)
    }
  }
}
