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

    cached = { canvas, texture }
  }
  return cached
}
