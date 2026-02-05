import type { AudioManager } from '../AudioManager'

export class ErsSound {
  private audioManager: AudioManager
  private deployActive = false
  private harvestActive = false
  private batteryCriticalActive = false

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager
  }

  registerSounds(): void {
    this.audioManager.registerSound('ers-deploy', {
      src: '/audio/effects/ers-deploy.mp3',
      category: 'effects',
      loop: true,
      volume: 0.5,
    })

    this.audioManager.registerSound('ers-harvest', {
      src: '/audio/effects/ers-harvest.mp3',
      category: 'effects',
      loop: true,
      volume: 0.4,
    })

    this.audioManager.registerSound('ers-overtake', {
      src: '/audio/effects/overtake.mp3',
      category: 'effects',
      volume: 0.8,
    })

    this.audioManager.registerSound('ers-battery-critical', {
      src: '/audio/effects/battery-critical.mp3',
      category: 'effects',
      loop: true,
      volume: 0.6,
    })
  }

  update(
    isDeploying: boolean,
    isHarvesting: boolean,
    powerFlow: number,
    _harvestSource: string
  ): void {
    if (isDeploying && !this.deployActive) {
      this.deployActive = true
      this.audioManager.playLoop('ers-deploy')
    } else if (!isDeploying && this.deployActive) {
      this.deployActive = false
      this.audioManager.stopLoop('ers-deploy')
    }

    if (this.deployActive) {
      const rate = 0.8 + (powerFlow / 350) * 0.6
      this.audioManager.setLoopRate('ers-deploy', rate)
    }

    if (isHarvesting && !this.harvestActive) {
      this.harvestActive = true
      this.audioManager.playLoop('ers-harvest')
    } else if (!isHarvesting && this.harvestActive) {
      this.harvestActive = false
      this.audioManager.stopLoop('ers-harvest')
    }
  }

  onOvertakeActivated(): void {
    this.audioManager.play('ers-overtake')
  }

  onBatteryCritical(isCritical: boolean): void {
    if (isCritical && !this.batteryCriticalActive) {
      this.batteryCriticalActive = true
      this.audioManager.playLoop('ers-battery-critical')
    } else if (!isCritical && this.batteryCriticalActive) {
      this.batteryCriticalActive = false
      this.audioManager.stopLoop('ers-battery-critical')
    }
  }

  dispose(): void {
    if (this.deployActive) {
      this.audioManager.stopLoop('ers-deploy')
      this.deployActive = false
    }
    if (this.harvestActive) {
      this.audioManager.stopLoop('ers-harvest')
      this.harvestActive = false
    }
    if (this.batteryCriticalActive) {
      this.audioManager.stopLoop('ers-battery-critical')
      this.batteryCriticalActive = false
    }
  }
}
