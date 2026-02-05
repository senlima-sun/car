import type { AudioManager } from '../AudioManager'

const SOUND_ID = 'collision'

export class CollisionSound {
  private audioManager: AudioManager

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound(SOUND_ID, {
      src: '/audio/effects/collision.mp3',
      category: 'effects',
      loop: false,
      volume: 1,
    })
  }

  playImpact(force: number): void {
    const volume = Math.max(0, Math.min(1, force))
    this.audioManager.registerSound(SOUND_ID, {
      src: '/audio/effects/collision.mp3',
      category: 'effects',
      loop: false,
      volume,
    })
    this.audioManager.play(SOUND_ID)
  }
}
