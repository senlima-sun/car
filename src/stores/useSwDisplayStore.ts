import { create } from 'zustand'
import * as THREE from 'three'

const canvas = document.createElement('canvas')
canvas.width = 1280
canvas.height = 640

const texture = new THREE.CanvasTexture(canvas)
texture.colorSpace = THREE.SRGBColorSpace
texture.flipY = false

interface SwDisplayState {
  canvas: HTMLCanvasElement
  texture: THREE.CanvasTexture
}

export const useSwDisplayStore = create<SwDisplayState>()(() => ({
  canvas,
  texture,
}))
