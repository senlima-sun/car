import type { AudioManager } from '../AudioManager'

type TireSurface = 'road' | 'grass' | 'curb'

const SOUND_IDS: Record<TireSurface, string> = {
  road: 'tire-screech',
  grass: 'grass-roll',
  curb: 'curb-rattle',
}

const CROSSFADE_DURATION = 200

export class TireSound {
  private audioManager: AudioManager
  private activeSurface: TireSurface | null = null
  private playing = false
  private fadeOutTimer: ReturnType<typeof setTimeout> | null = null

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound(SOUND_IDS.road, {
      src: '/audio/effects/tire-screech.mp3',
      category: 'effects',
      loop: true,
      volume: 0,
    })

    this.audioManager.registerSound(SOUND_IDS.grass, {
      src: '/audio/effects/grass-roll.mp3',
      category: 'effects',
      loop: true,
      volume: 0,
    })

    this.audioManager.registerSound(SOUND_IDS.curb, {
      src: '/audio/effects/curb-rattle.mp3',
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

    if (this.activeSurface) {
      this.audioManager.stopLoop(SOUND_IDS[this.activeSurface])
      this.activeSurface = null
    }

    this.clearFadeTimer()
  }

  update(slipAngle: number, surface: TireSurface): void {
    if (!this.playing) return

    const volume = this.computeVolume(slipAngle)

    if (this.activeSurface && this.activeSurface !== surface) {
      this.crossfade(this.activeSurface, surface, volume)
      return
    }

    if (!this.activeSurface && volume > 0) {
      this.activeSurface = surface
      this.audioManager.playLoop(SOUND_IDS[surface])
      this.audioManager.setLoopVolume(SOUND_IDS[surface], volume)
      return
    }

    if (this.activeSurface) {
      if (volume === 0) {
        this.audioManager.stopLoop(SOUND_IDS[this.activeSurface])
        this.activeSurface = null
      } else {
        this.audioManager.setLoopVolume(SOUND_IDS[this.activeSurface], volume)
      }
    }
  }

  private computeVolume(slipAngle: number): number {
    if (slipAngle < 5) return 0
    if (slipAngle > 15) return 1
    return (slipAngle - 5) / 10
  }

  private crossfade(from: TireSurface, to: TireSurface, targetVolume: number): void {
    this.clearFadeTimer()

    const fromId = SOUND_IDS[from]
    const toId = SOUND_IDS[to]

    this.audioManager.playLoop(toId)
    this.audioManager.setLoopVolume(toId, targetVolume)

    this.audioManager.setLoopVolume(fromId, 0)

    this.fadeOutTimer = setTimeout(() => {
      this.audioManager.stopLoop(fromId)
      this.fadeOutTimer = null
    }, CROSSFADE_DURATION)

    this.activeSurface = to
  }

  private clearFadeTimer(): void {
    if (this.fadeOutTimer !== null) {
      clearTimeout(this.fadeOutTimer)
      this.fadeOutTimer = null
    }
  }
}
