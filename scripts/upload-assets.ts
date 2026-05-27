import { execSync } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const BUCKET = 'car-assets'
const ROOT = 'apps/game/public'
const INCLUDE_DIRS = ['models', 'textures', 'ai-replays', 'demos']

const MIME: Record<string, string> = {
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.hdr': 'image/vnd.radiance',
  '.exr': 'image/x-exr',
  '.json': 'application/json',
  '.bin': 'application/octet-stream',
}

const CACHE_CONTROL = 'public, max-age=31536000, immutable'

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

const files = INCLUDE_DIRS
  .map(d => join(ROOT, d))
  .flatMap(d => {
    try { return walk(d) } catch { return [] }
  })

console.log(`Uploading ${files.length} files to r2://${BUCKET}\n`)

let totalBytes = 0
for (const file of files) {
  const key = relative(ROOT, file)
  const size = statSync(file).size
  totalBytes += size
  const mime = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
  console.log(`→ ${key} (${(size / 1024).toFixed(1)} KB)`)
  execSync(
    `wrangler r2 object put "${BUCKET}/${key}" --file="${file}" --content-type="${mime}" --cache-control="${CACHE_CONTROL}" --remote`,
    { stdio: ['ignore', 'ignore', 'inherit'] },
  )
}

console.log(`\n✅ Uploaded ${files.length} files (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`)
