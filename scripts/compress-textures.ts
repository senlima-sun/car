import sharp from 'sharp'
import { readdirSync, statSync, renameSync, unlinkSync } from 'node:fs'
import { join, extname, basename } from 'node:path'

const DIR = 'apps/game/public/textures'
const QUALITY = 85
const MIN_BYTES = 100_000

const fmt = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MB`

const files = readdirSync(DIR)
  .filter(f => /\.(png|jpe?g)$/i.test(f))
  .map(f => join(DIR, f))

let totalBefore = 0
let totalAfter = 0

for (const src of files) {
  const before = statSync(src).size
  totalBefore += before

  if (before < MIN_BYTES) {
    totalAfter += before
    console.log(`skip ${basename(src)} (${fmt(before)}, too small)`)
    continue
  }

  const dst = src.replace(/\.(png|jpe?g)$/i, '.webp')
  await sharp(src).webp({ quality: QUALITY, effort: 6 }).toFile(dst)
  const after = statSync(dst).size
  totalAfter += after

  if (extname(src).toLowerCase() !== '.webp') unlinkSync(src)
  const pct = ((1 - after / before) * 100).toFixed(1)
  console.log(`${basename(src)} (${fmt(before)}) → ${basename(dst)} (${fmt(after)}, -${pct}%)`)
}

const pct = ((1 - totalAfter / totalBefore) * 100).toFixed(1)
console.log(`\nTOTAL: ${fmt(totalBefore)} → ${fmt(totalAfter)} (saved ${pct}%)`)
