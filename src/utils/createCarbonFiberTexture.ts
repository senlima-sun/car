import * as THREE from 'three'

/**
 * Programmatically creates a texture that mimics the look of carbon fiber.
 * This is based on the texture generation logic from the example file.
 * @returns A THREE.CanvasTexture ready to be used in a material.
 */
export function createCarbonFiberTexture(): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    // Return a plain black texture if context fails
    const blackCanvas = document.createElement('canvas')
    blackCanvas.width = 1
    blackCanvas.height = 1
    const blackCtx = blackCanvas.getContext('2d')
    if (blackCtx) {
      blackCtx.fillStyle = '#111'
      blackCtx.fillRect(0, 0, 1, 1)
    }
    return new THREE.CanvasTexture(blackCanvas)
  }

  // Background
  ctx.fillStyle = '#111'
  ctx.fillRect(0, 0, size, size)

  // Weave pattern
  const numSquares = 16
  const sqSize = size / numSquares

  for (let y = 0; y < numSquares; y++) {
    for (let x = 0; x < numSquares; x++) {
      // Checkerboard logic for weave direction
      if ((x + y) % 2 === 0) {
        // Horizontal-ish weave lines
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(x * sqSize, y * sqSize, sqSize, sqSize)

        ctx.fillStyle = '#2a2a2a'
        for (let k = 0; k < 5; k++) {
          ctx.fillRect(x * sqSize, y * sqSize + k * (sqSize / 5), sqSize, 2)
        }
      } else {
        // Vertical-ish weave lines
        ctx.fillStyle = '#0a0a0a'
        ctx.fillRect(x * sqSize, y * sqSize, sqSize, sqSize)

        ctx.fillStyle = '#1f1f1f'
        for (let k = 0; k < 5; k++) {
          ctx.fillRect(x * sqSize + k * (sqSize / 5), y * sqSize, 2, sqSize)
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(8, 8) // Repeat more for a finer pattern on the model
  return texture
}
