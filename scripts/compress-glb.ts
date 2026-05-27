import { execSync } from 'node:child_process'
import { mkdtempSync, statSync, rmSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, basename } from 'node:path'

type Target = {
  src: string
  maxTextureSize: number
  draco?: boolean
}

const TARGETS: Target[] = [
  { src: 'apps/game/public/models/steering-wheel.glb', maxTextureSize: 1024, draco: false },
  { src: 'apps/game/public/models/f1_2026.glb', maxTextureSize: 1024 },
  { src: 'apps/game/public/models/f1_2026_audi_normalized.glb', maxTextureSize: 1024 },
]

const fmt = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MB`

function run(cmd: string) {
  execSync(cmd, { stdio: 'inherit' })
}

function compress(target: Target) {
  const { src, maxTextureSize, draco = true } = target
  const before = statSync(src).size
  const tmp = mkdtempSync(join(tmpdir(), 'glb-'))
  const a = join(tmp, '1.glb')
  const b = join(tmp, '2.glb')
  const c = join(tmp, '3.glb')

  console.log(`\n=== ${basename(src)} (${fmt(before)}) ===`)

  run(`pnpm dlx @gltf-transform/cli resize "${src}" "${a}" --width ${maxTextureSize} --height ${maxTextureSize}`)
  run(`pnpm dlx @gltf-transform/cli webp "${a}" "${b}" --quality 85`)
  if (draco) {
    run(`pnpm dlx @gltf-transform/cli draco "${b}" "${c}"`)
  } else {
    copyFileSync(b, c)
  }

  copyFileSync(c, src)
  rmSync(tmp, { recursive: true, force: true })

  const after = statSync(src).size
  const pct = ((1 - after / before) * 100).toFixed(1)
  console.log(`→ ${fmt(after)} (saved ${pct}%)`)
}

for (const t of TARGETS) compress(t)
