import { createCanvas, loadImage } from '@napi-rs/canvas'
import fs from 'fs'
import path from 'path'

const SIZE = 4096

interface Region {
  label: string
  color: string
  uvMinU: number
  uvMaxU: number
  uvMinV: number
  uvMaxV: number
  centerU: number
  centerV: number
  vertCount: number
}

const REGIONS: Region[] = [
  {
    label: 'Upper Body (L)',
    color: '#88FF44',
    uvMinU: 0.02,
    uvMaxU: 0.17,
    uvMinV: 0.7,
    uvMaxV: 0.98,
    centerU: 0.093,
    centerV: 0.861,
    vertCount: 5330,
  },
  {
    label: 'Side Panel (R)',
    color: '#FF6644',
    uvMinU: 0.67,
    uvMaxU: 0.84,
    uvMinV: 0.37,
    uvMaxV: 0.53,
    centerU: 0.779,
    centerV: 0.466,
    vertCount: 5108,
  },
  {
    label: 'Engine Cover (Top)',
    color: '#00FFAA',
    uvMinU: 0.88,
    uvMaxU: 0.99,
    uvMinV: 0.61,
    uvMaxV: 0.79,
    centerU: 0.933,
    centerV: 0.675,
    vertCount: 3319,
  },
  {
    label: 'Engine Cover (R)',
    color: '#00FFAA',
    uvMinU: 0.77,
    uvMaxU: 0.93,
    uvMinV: 0.41,
    uvMaxV: 0.52,
    centerU: 0.822,
    centerV: 0.479,
    vertCount: 3067,
  },
  {
    label: 'Sidepod (Top)',
    color: '#00FF44',
    uvMinU: 0.9,
    uvMaxU: 0.99,
    uvMinV: 0.8,
    uvMaxV: 0.88,
    centerU: 0.942,
    centerV: 0.852,
    vertCount: 2536,
  },
  {
    label: 'Airbox',
    color: '#00DDFF',
    uvMinU: 0.75,
    uvMaxU: 0.86,
    uvMinV: 0.55,
    uvMaxV: 0.66,
    centerU: 0.804,
    centerV: 0.615,
    vertCount: 2086,
  },
  {
    label: 'Upper Body (R)',
    color: '#88FF44',
    uvMinU: 0.2,
    uvMaxU: 0.29,
    uvMinV: 0.67,
    uvMaxV: 0.94,
    centerU: 0.239,
    centerV: 0.824,
    vertCount: 2007,
  },
  {
    label: 'Side Panel (bottom L)',
    color: '#FF6644',
    uvMinU: 0.19,
    uvMaxU: 0.62,
    uvMinV: 0.03,
    uvMaxV: 0.12,
    centerU: 0.394,
    centerV: 0.067,
    vertCount: 1866,
  },
  {
    label: 'Side Panel (bottom R)',
    color: '#FF6644',
    uvMinU: 0.19,
    uvMaxU: 0.62,
    uvMinV: 0.18,
    uvMaxV: 0.26,
    centerU: 0.394,
    centerV: 0.212,
    vertCount: 1865,
  },
  {
    label: 'Rear Wing',
    color: '#4400FF',
    uvMinU: 0.7,
    uvMaxU: 0.8,
    uvMinV: 0.62,
    uvMaxV: 0.72,
    centerU: 0.755,
    centerV: 0.654,
    vertCount: 1838,
  },
  {
    label: 'Diffuser (L)',
    color: '#AA00FF',
    uvMinU: 0.03,
    uvMaxU: 0.13,
    uvMinV: 0.51,
    uvMaxV: 0.62,
    centerU: 0.071,
    centerV: 0.573,
    vertCount: 1679,
  },
  {
    label: 'Shark Fin',
    color: '#0088FF',
    uvMinU: 0.23,
    uvMaxU: 0.43,
    uvMinV: 0.44,
    uvMaxV: 0.6,
    centerU: 0.327,
    centerV: 0.543,
    vertCount: 1642,
  },
  {
    label: 'Side Panel (mid)',
    color: '#FF6644',
    uvMinU: 0.37,
    uvMaxU: 0.61,
    uvMinV: 0.31,
    uvMaxV: 0.36,
    centerU: 0.49,
    centerV: 0.337,
    vertCount: 1675,
  },
  {
    label: 'Cockpit',
    color: '#FFDD00',
    uvMinU: 0.45,
    uvMaxU: 0.57,
    uvMinV: 0.47,
    uvMaxV: 0.6,
    centerU: 0.523,
    centerV: 0.523,
    vertCount: 1384,
  },
  {
    label: 'Diffuser (R)',
    color: '#AA00FF',
    uvMinU: 0.04,
    uvMaxU: 0.15,
    uvMinV: 0.29,
    uvMaxV: 0.47,
    centerU: 0.093,
    centerV: 0.381,
    vertCount: 1316,
  },
  {
    label: 'Engine Cover (bottom L)',
    color: '#00FFAA',
    uvMinU: 0.43,
    uvMaxU: 0.63,
    uvMinV: 0.06,
    uvMaxV: 0.15,
    centerU: 0.545,
    centerV: 0.1,
    vertCount: 1403,
  },
  {
    label: 'Engine Cover (bottom R)',
    color: '#00FFAA',
    uvMinU: 0.43,
    uvMaxU: 0.63,
    uvMinV: 0.2,
    uvMaxV: 0.29,
    centerU: 0.545,
    centerV: 0.245,
    vertCount: 1403,
  },
  {
    label: 'Upper Body (top R)',
    color: '#88FF44',
    uvMinU: 0.72,
    uvMaxU: 0.85,
    uvMinV: 0.79,
    uvMaxV: 0.98,
    centerU: 0.788,
    centerV: 0.895,
    vertCount: 1054,
  },
  {
    label: 'Nose Cone',
    color: '#FF8800',
    uvMinU: 0.62,
    uvMaxU: 0.66,
    uvMinV: 0.73,
    uvMaxV: 0.93,
    centerU: 0.643,
    centerV: 0.836,
    vertCount: 333,
  },
  {
    label: 'Front Wing',
    color: '#FF4444',
    uvMinU: 0.61,
    uvMaxU: 0.65,
    uvMinV: 0.31,
    uvMaxV: 0.45,
    centerU: 0.633,
    centerV: 0.38,
    vertCount: 336,
  },
  {
    label: 'Front Section',
    color: '#FFAA44',
    uvMinU: 0.66,
    uvMaxU: 0.83,
    uvMinV: 0.23,
    uvMaxV: 0.34,
    centerU: 0.749,
    centerV: 0.288,
    vertCount: 566,
  },
  {
    label: 'Rear Wing (bottom)',
    color: '#4400FF',
    uvMinU: 0.01,
    uvMaxU: 0.11,
    uvMinV: 0.03,
    uvMaxV: 0.09,
    centerU: 0.091,
    centerV: 0.06,
    vertCount: 462,
  },
  {
    label: 'Rear Wing (top)',
    color: '#4400FF',
    uvMinU: 0.01,
    uvMaxU: 0.11,
    uvMinV: 0.18,
    uvMaxV: 0.23,
    centerU: 0.091,
    centerV: 0.205,
    vertCount: 459,
  },
  {
    label: 'Side Panel (upper)',
    color: '#FF6644',
    uvMinU: 0.38,
    uvMaxU: 0.61,
    uvMinV: 0.4,
    uvMaxV: 0.45,
    centerU: 0.496,
    centerV: 0.424,
    vertCount: 1568,
  },
  {
    label: 'Engine Cover (far R)',
    color: '#00FFAA',
    uvMinU: 0.33,
    uvMaxU: 0.48,
    uvMinV: 0.83,
    uvMaxV: 0.98,
    centerU: 0.4,
    centerV: 0.92,
    vertCount: 1803,
  },
  {
    label: 'Floor / Underbody',
    color: '#FF00AA',
    uvMinU: 0.28,
    uvMaxU: 0.3,
    uvMinV: 0.72,
    uvMaxV: 0.84,
    centerU: 0.286,
    centerV: 0.783,
    vertCount: 237,
  },
  {
    label: 'Upper Body (mid)',
    color: '#88FF44',
    uvMinU: 0.48,
    uvMaxU: 0.65,
    uvMinV: 0.73,
    uvMaxV: 0.92,
    centerU: 0.577,
    centerV: 0.858,
    vertCount: 638,
  },
  {
    label: 'Engine Cover (mid)',
    color: '#00FFAA',
    uvMinU: 0.33,
    uvMaxU: 0.51,
    uvMinV: 0.65,
    uvMaxV: 0.83,
    centerU: 0.43,
    centerV: 0.74,
    vertCount: 1334,
  },
]

async function main() {
  const canvas = createCanvas(SIZE, SIZE)
  const ctx = canvas.getContext('2d')

  // Load UV layout as background
  const bgImage = await loadImage(path.resolve('uv_layout_car_body.png'))
  ctx.drawImage(bgImage, 0, 0, SIZE, SIZE)

  // Draw colored regions
  for (const r of REGIONS) {
    const x1 = Math.round(r.uvMinU * SIZE)
    const y1 = Math.round((1 - r.uvMaxV) * SIZE)
    const x2 = Math.round(r.uvMaxU * SIZE)
    const y2 = Math.round((1 - r.uvMinV) * SIZE)
    const w = x2 - x1
    const h = y2 - y1

    // Filled region
    ctx.globalAlpha = 0.2
    ctx.fillStyle = r.color
    ctx.fillRect(x1, y1, w, h)

    // Border
    ctx.globalAlpha = 0.8
    ctx.strokeStyle = r.color
    ctx.lineWidth = 4
    ctx.strokeRect(x1, y1, w, h)

    // Label
    ctx.globalAlpha = 1.0
    const cx = Math.round(r.centerU * SIZE)
    const cy = Math.round((1 - r.centerV) * SIZE)

    const fontSize = Math.max(24, Math.min(44, Math.round(Math.sqrt(r.vertCount) * 0.8)))

    // Text background
    ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`
    const textMetrics = ctx.measureText(r.label)
    const textW = textMetrics.width + 12
    const textH = fontSize + 8

    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.fillRect(cx - textW / 2, cy - textH / 2 - 2, textW, textH)

    ctx.fillStyle = r.color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(r.label, cx, cy)
  }

  // Legend
  const legendX = 40
  let legendY = 40
  const legendFontSize = 36
  const legendPadding = 44

  ctx.globalAlpha = 0.85
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
  const uniqueLabels = [...new Map(REGIONS.map(r => [r.label.replace(/ \(.*\)/, ''), r.color]))]
  ctx.fillRect(legendX - 10, legendY - 10, 500, uniqueLabels.length * legendPadding + 20)

  ctx.globalAlpha = 1.0
  ctx.font = `bold ${legendFontSize}px Helvetica, Arial, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  for (const [label, color] of uniqueLabels) {
    ctx.fillStyle = color
    ctx.fillRect(legendX, legendY, 30, 30)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(label, legendX + 42, legendY + 15)
    legendY += legendPadding
  }

  // Save
  const outPath = path.resolve('uv_layout_annotated.png')
  const buffer = canvas.toBuffer('image/png')
  fs.writeFileSync(outPath, buffer)
  console.log(`Annotated UV layout saved to ${outPath}`)
}

main().catch(console.error)
