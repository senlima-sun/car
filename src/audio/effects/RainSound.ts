import type { AudioManager } from '../AudioManager'

const SOUND_ID = 'rain'
const FADE_OUT_DURATION = 1000

export class RainSound {
  private audioManager: AudioManager
  private playing = false
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound(SOUND_ID, {
      src: '/audio/effects/rain.mp3',
      category: 'effects',
      loop: true,
      volume: 0,
    })
  }

  start(): void {
    if (this.playing) return
    this.playing = true
  }

  stop(): void {
    if (!this.playing) return
    this.playing = false
    this.clearFadeTimer()
    this.audioManager.stopLoop(SOUND_ID)
  }

  update(rainIntensity: number): void {
    if (!this.playing) return

    if (rainIntensity > 0) {
      this.clearFadeTimer()
      this.audioManager.playLoop(SOUND_ID)
      this.audioManager.setLoopVolume(SOUND_ID, rainIntensity)
    } else {
      this.fadeOut()
    }
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
