import type { AudioManager } from '../AudioManager'

const SOUND_ID = 'wind'

export class WindSound {
  private audioManager: AudioManager
  private playing = false

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound(SOUND_ID, {
      src: '/audio/effects/wind.mp3',
      category: 'effects',
      loop: true,
      volume: 0,
    })
  }

  start(): void {
    if (this.playing) return
    this.playing = true
    this.audioManager.playLoop(SOUND_ID)
    this.audioManager.setLoopVolume(SOUND_ID, 0)
  }

  stop(): void {
    if (!this.playing) return
    this.playing = false
    this.audioManager.stopLoop(SOUND_ID)
  }

  update(speedKmh: number, windSpeed: number): void {
    if (!this.playing) return

    const speedContribution = Math.max(0, Math.min(1, (speedKmh - 60) / 200)) * 0.6
    const windContribution = (windSpeed / 30) * 0.3
    const volume = Math.min(1, speedContribution + windContribution)

    const rate = 0.8 + (speedKmh / 300) * 0.4

    this.audioManager.setLoopVolume(SOUND_ID, volume)
    this.audioManager.setLoopRate(SOUND_ID, rate)
  }
}
