import { LoopVoice, OneShotVoice } from '../SynthVoice'

export class OverheatAlarmVoice extends LoopVoice {
  private osc!: OscillatorNode
  private intervalId: ReturnType<typeof setInterval> | null = null
  private high = true

  protected startNodes(): void {
    this.osc = this.ctx.createOscillator()
    this.osc.type = 'square'
    this.osc.frequency.value = 880

    this.osc.connect(this.output)
    this.osc.start()

    this.high = true
    this.intervalId = setInterval(() => {
      this.high = !this.high
      this.osc.frequency.setValueAtTime(
        this.high ? 880 : 660,
        this.ctx.currentTime
      )
    }, 250)
  }

  protected stopNodes(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.osc.stop()
  }
}

export class TrackViolationVoice extends OneShotVoice {
  protected playOneShot(dest: AudioNode, volume: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 1000

    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, this.ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1)

    osc.connect(gain)
    gain.connect(dest)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.15)
  }
}
