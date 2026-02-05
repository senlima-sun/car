import type { AudioManager } from '../AudioManager'

export class UISound {
  private audioManager: AudioManager

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound('ui-click', {
      src: '/audio/ui/click.mp3',
      category: 'ui',
      volume: 0.6,
    })

    this.audioManager.registerSound('ui-lap-complete', {
      src: '/audio/ui/lap-complete.mp3',
      category: 'ui',
      volume: 0.8,
    })

    this.audioManager.registerSound('ui-best-lap', {
      src: '/audio/ui/best-lap.mp3',
      category: 'ui',
      volume: 0.9,
    })

    this.audioManager.registerSound('ui-gear-shift', {
      src: '/audio/ui/gear-shift.mp3',
      category: 'ui',
      volume: 0.5,
    })

    this.audioManager.registerSound('ui-pit-complete', {
      src: '/audio/ui/pit-complete.mp3',
      category: 'ui',
      volume: 0.7,
    })

    this.audioManager.registerSound('ui-mode-toggle', {
      src: '/audio/ui/mode-toggle.mp3',
      category: 'ui',
      volume: 0.5,
    })
  }

  playClick(): void {
    this.audioManager.play('ui-click')
  }

  playLapComplete(): void {
    this.audioManager.play('ui-lap-complete')
  }

  playBestLap(): void {
    this.audioManager.play('ui-best-lap')
  }

  playGearShift(): void {
    this.audioManager.play('ui-gear-shift')
  }

  playPitComplete(): void {
    this.audioManager.play('ui-pit-complete')
  }

  playModeToggle(): void {
    this.audioManager.play('ui-mode-toggle')
  }
}
