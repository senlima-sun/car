import type { AudioManager } from '../AudioManager'

export class TrackLimitsSound {
  private audioManager: AudioManager

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound('track-violation', {
      src: '/audio/effects/track-violation.mp3',
      category: 'effects',
      volume: 0.7,
    })
  }

  onViolation(): void {
    this.audioManager.play('track-violation')
  }
}
