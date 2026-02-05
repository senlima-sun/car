import type { AudioManager } from '../AudioManager'

const SOUND_ID = 'drift'
const FADE_OUT_DURATION = 300

export class DriftSound {
  private audioManager: AudioManager
  private wasDrifting = false
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound(SOUND_ID, {
      src: '/audio/effects/drift.mp3',
      category: 'effects',
      loop: true,
      volume: 0,
    })
  }

  update(isDrifting: boolean, skidIntensity: number): void {
    if (isDrifting && !this.wasDrifting) {
      this.clearFadeTimer()
      this.audioManager.playLoop(SOUND_ID)
      this.audioManager.setLoopVolume(SOUND_ID, skidIntensity)
    } else if (isDrifting && this.wasDrifting) {
      this.audioManager.setLoopVolume(SOUND_ID, skidIntensity)
    } else if (!isDrifting && this.wasDrifting) {
      this.fadeOut()
    }

    this.wasDrifting = isDrifting
  }

  private fadeOut(): void {
    this.clearFadeTimer()
    this.audioManager.setLoopVolume(SOUND_ID, 0)

    this.fadeOutTimer = setTimeout(() => {
      this.audioManager.stopLoop(SOUND_ID)
      this.fadeOutTimer = null
    }, FADE_OUT_DURATION)
  }

  private clearFadeTimer(): void {
    if (this.fadeOutTimer !== null) {
      clearTimeout(this.fadeOutTimer)
      this.fadeOutTimer = null
    }
  }
}
