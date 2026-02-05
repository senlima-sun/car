import type { AudioManager } from '../AudioManager'

const SOUND_ID = 'aquaplaning'
const FADE_OUT_DURATION = 200

export class AquaplaningSound {
  private audioManager: AudioManager
  private wasAquaplaning = false
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound(SOUND_ID, {
      src: '/audio/effects/aquaplaning.mp3',
      category: 'effects',
      loop: true,
      volume: 0,
    })
  }

  update(isAquaplaning: boolean, intensity: number): void {
    if (isAquaplaning && !this.wasAquaplaning) {
      this.clearFadeTimer()
      this.audioManager.playLoop(SOUND_ID)
      this.audioManager.setLoopVolume(SOUND_ID, intensity * 0.8)
    } else if (isAquaplaning && this.wasAquaplaning) {
      this.audioManager.setLoopVolume(SOUND_ID, intensity * 0.8)
    } else if (!isAquaplaning && this.wasAquaplaning) {
      this.fadeOut()
    }

    this.wasAquaplaning = isAquaplaning
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
