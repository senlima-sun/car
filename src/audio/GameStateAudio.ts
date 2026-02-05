import type { AudioManager } from './AudioManager'

type GameStatus = 'menu' | 'countdown' | 'racing' | 'paused' | 'finished' | 'customize'

const COUNTDOWN_INTERVAL = 1000
const COUNTDOWN_BEEPS = 3

export class GameStateAudio {
  private audioManager: AudioManager
  private countdownTimers: ReturnType<typeof setTimeout>[] = []
  private previousMasterVolume = 0.8

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound('countdown-beep', {
      src: '/audio/ui/countdown-beep.mp3',
      category: 'ui',
      volume: 0.8,
    })

    this.audioManager.registerSound('countdown-go', {
      src: '/audio/ui/countdown-go.mp3',
      category: 'ui',
      volume: 0.9,
    })

    this.audioManager.registerSound('game-pause', {
      src: '/audio/ui/pause.mp3',
      category: 'ui',
      volume: 0.5,
    })

    this.audioManager.registerSound('game-resume', {
      src: '/audio/ui/resume.mp3',
      category: 'ui',
      volume: 0.5,
    })

    this.audioManager.registerSound('race-finish', {
      src: '/audio/ui/race-finish.mp3',
      category: 'ui',
      volume: 0.9,
    })
  }

  onStatusChange(newStatus: GameStatus, previousStatus: GameStatus): void {
    if (newStatus === previousStatus) return

    switch (newStatus) {
      case 'countdown':
        this.playCountdownSequence()
        break

      case 'paused':
        this.previousMasterVolume = 0.8
        this.audioManager.setMasterVolume(0.2)
        this.audioManager.play('game-pause')
        break

      case 'racing':
        if (previousStatus === 'paused') {
          this.audioManager.setMasterVolume(this.previousMasterVolume)
          this.audioManager.play('game-resume')
        }
        break

      case 'finished':
        this.audioManager.play('race-finish')
        break
    }
  }

  dispose(): void {
    this.clearCountdownTimers()
  }

  private playCountdownSequence(): void {
    this.clearCountdownTimers()

    for (let i = 0; i < COUNTDOWN_BEEPS; i++) {
      const timer = setTimeout(() => {
        this.audioManager.play('countdown-beep')
      }, i * COUNTDOWN_INTERVAL)
      this.countdownTimers.push(timer)
    }

    const goTimer = setTimeout(() => {
      this.audioManager.play('countdown-go')
    }, COUNTDOWN_BEEPS * COUNTDOWN_INTERVAL)
    this.countdownTimers.push(goTimer)
  }

  private clearCountdownTimers(): void {
    for (const timer of this.countdownTimers) {
      clearTimeout(timer)
    }
    this.countdownTimers = []
  }
}
