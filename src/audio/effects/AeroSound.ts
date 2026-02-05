import type { AudioManager } from '../AudioManager'

export class AeroSound {
  private audioManager: AudioManager

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound('aero-toggle', {
      src: '/audio/effects/aero-toggle.mp3',
      category: 'effects',
      volume: 0.6,
    })
  }

  onModeToggle(_newMode: 'Corner' | 'Straight'): void {
    this.audioManager.play('aero-toggle')
  }
}
