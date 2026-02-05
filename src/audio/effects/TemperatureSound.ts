import type { AudioManager } from '../AudioManager'

const FADE_OUT_DURATION = 500

export class TemperatureSound {
  private audioManager: AudioManager
  private overheatActive = false
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound('overheat-alarm', {
      src: '/audio/effects/overheat-alarm.mp3',
      category: 'effects',
      loop: true,
      volume: 0.7,
    })
  }

  onOverheatChanged(isOverheating: boolean): void {
    if (isOverheating && !this.overheatActive) {
      this.clearFadeTimer()
      this.overheatActive = true
      this.audioManager.playLoop('overheat-alarm')
    } else if (!isOverheating && this.overheatActive) {
      this.overheatActive = false
      this.audioManager.setLoopVolume('overheat-alarm', 0)
      this.fadeOutTimer = setTimeout(() => {
        this.audioManager.stopLoop('overheat-alarm')
        this.fadeOutTimer = null
      }, FADE_OUT_DURATION)
    }
  }

  dispose(): void {
    this.clearFadeTimer()
    if (this.overheatActive) {
      this.audioManager.stopLoop('overheat-alarm')
      this.overheatActive = false
    }
  }

  private clearFadeTimer(): void {
    if (this.fadeOutTimer !== null) {
      clearTimeout(this.fadeOutTimer)
      this.fadeOutTimer = null
    }
  }
}
