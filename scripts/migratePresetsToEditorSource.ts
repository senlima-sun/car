#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { importTrackObjectsToEditorState } from '../src/components/ui/TrackEditor/import/trackObjectsToEditor'
import type { EditorTrackSource } from '../src/utils/editorTrackSource'

type RuntimePresetTrack = {
  id: string
  name: string
  trackLength: number
  turns: number
  objects: unknown[]
}

function stableSource(track: EditorTrackSource): EditorTrackSource {
  return {
    ...track,
    paths: track.paths.map((path, pathIndex) => {
      const pathId = `${track.id}_path_${pathIndex}`
      return {
        ...path,
        id: pathId,
        anchors: path.anchors.map((anchor, anchorIndex) => {
          if ('kind' in anchor) {
            return {
              ...anchor,
              pathId:
                anchor.pathId === path.id
                  ? pathId
                  : `${track.id}_path_${track.paths.findIndex(candidate => candidate.id === anchor.pathId)}`,
            }
          }

          return {
            ...anchor,
            id: `${pathId}_anchor_${anchorIndex}`,
          }
        }),
      }
    }),
    checkpoints: track.checkpoints.map((checkpoint, checkpointIndex) => ({
      ...checkpoint,
      id: `${track.id}_checkpoint_${checkpointIndex}`,
      pathId:
        checkpoint.pathId === track.paths.find(path => path.id === checkpoint.pathId)?.id
          ? `${track.id}_path_${track.paths.findIndex(path => path.id === checkpoint.pathId)}`
          : checkpoint.pathId,
    })),
    pitBoxAreas: track.pitBoxAreas?.map((pitBoxArea, index) => ({
      ...pitBoxArea,
      id: `${track.id}_pitbox_${index}`,
    })),
  }
}

function migrateTrack(inputPath: string, outputPath: string): void {
  const runtime = JSON.parse(readFileSync(inputPath, 'utf8')) as RuntimePresetTrack
  const imported = importTrackObjectsToEditorState(runtime.objects as never)
  const source = stableSource({
    id: runtime.id,
    name: runtime.name,
    trackLength: runtime.trackLength,
    turns: runtime.turns,
    paths: imported.doc.paths,
    checkpoints: imported.checkpoints,
    raceDirection: imported.raceDirection,
    pitBoxAreas: imported.pitBoxAreas,
  })

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(source, null, 2)}\n`)
  console.log(`wrote ${outputPath}`)
}

const root = resolve(import.meta.dir, '..')
const runtimeDir = resolve(root, 'src/constants/tracks')
const sourceDir = resolve(root, 'src/constants/tracks/sources')

for (const name of ['silverstone', 'suzuka', 'monza', 'shanghai']) {
  migrateTrack(resolve(runtimeDir, `${name}.json`), resolve(sourceDir, `${name}.json`))
}
