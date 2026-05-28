import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { PRESET_TRACK_IDS } from '../src/entitlements/dailyGrant.ts'

const SOURCES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../game/src/constants/tracks/sources',
)

function readSourceTrackIds(): string[] {
  const files = readdirSync(SOURCES_DIR).filter(name => name.endsWith('.json'))
  return files.map(file => {
    const parsed = JSON.parse(readFileSync(join(SOURCES_DIR, file), 'utf8')) as { id?: unknown }
    if (typeof parsed.id !== 'string') {
      throw new Error(`Missing or non-string 'id' in ${file}`)
    }
    return parsed.id
  })
}

describe('PRESET_TRACK_IDS parity with SPA preset tracks', () => {
  test('matches the set of ids in apps/game/src/constants/tracks/sources/*.json', () => {
    const sourceIds = new Set(readSourceTrackIds())
    const workerIds = new Set(PRESET_TRACK_IDS)

    const missingInWorker = [...sourceIds].filter(id => !workerIds.has(id)).sort()
    const extraInWorker = [...workerIds].filter(id => !sourceIds.has(id)).sort()

    expect(
      { missingInWorker, extraInWorker },
      'PRESET_TRACK_IDS in apps/api/src/entitlements/dailyGrant.ts drifted from apps/game/src/constants/tracks/sources/*.json',
    ).toEqual({ missingInWorker: [], extraInWorker: [] })
  })
})
