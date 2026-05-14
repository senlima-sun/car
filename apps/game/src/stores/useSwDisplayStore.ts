import * as THREE from 'three'

interface SwDisplay {
  canvas: HTMLCanvasElement
  texture: THREE.CanvasTexture
}

let cached: SwDisplay | null = null

export function getSwDisplay(): SwDisplay {
  if (!cached) {
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 640

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.flipY = false
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.generateMipmaps = true

    cached = { canvas, texture }
  }
  return cached
}

export function applySwDisplayAnisotropy(maxAnisotropy: number): void {
  if (!cached) return
  const target = Math.min(16, Math.max(1, Math.floor(maxAnisotropy)))
  if (cached.texture.anisotropy !== target) {
    cached.texture.anisotropy = target
    cached.texture.needsUpdate = true
  }
}
