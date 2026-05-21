import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { pathToRibbon } from './pathToRibbon'
import type { Path } from '../geometry/types'
import { useTerrainStore } from '@/stores/useTerrainStore'

import monacoSource from '@/constants/tracks/sources/monaco.json'
import bakuSource from '@/constants/tracks/sources/baku.json'
import singaporeSource from '@/constants/tracks/sources/singapore.json'
import cotaSource from '@/constants/tracks/sources/cota.json'
import interlagosSource from '@/constants/tracks/sources/interlagos.json'

type TrackSource = {
  id: string
  paths: Path[]
}

const originalGetHeightAt = useTerrainStore.getState().getHeightAt

afterEach(() => {
  useTerrainStore.setState({ getHeightAt: originalGetHeightAt })
})

function baselineStats(points: { x: number; y: number; z: number }[]) {
  const spacings: number[] = []
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!
    const curr = points[i]!
    spacings.push(Math.hypot(curr.x - prev.x, curr.z - prev.z))
  }
  if (spacings.length === 0) return { count: points.length, meanSpacing: 0, maxSpacing: 0, minSpacing: 0 }
  const mean = spacings.reduce((s, v) => s + v, 0) / spacings.length
  const max = Math.max(...spacings)
  const min = Math.min(...spacings)
  return { count: points.length, meanSpacing: Number(mean.toFixed(4)), maxSpacing: Number(max.toFixed(4)), minSpacing: Number(min.toFixed(4)) }
}

const circuits: { name: string; source: TrackSource }[] = [
  { name: 'monaco', source: monacoSource as unknown as TrackSource },
  { name: 'baku', source: bakuSource as unknown as TrackSource },
  { name: 'singapore', source: singaporeSource as unknown as TrackSource },
  { name: 'cota', source: cotaSource as unknown as TrackSource },
  { name: 'interlagos', source: interlagosSource as unknown as TrackSource },
]

describe('pathToRibbon baseline snapshot', () => {
  beforeEach(() => {
    useTerrainStore.setState({ getHeightAt: () => 0 })
  })

  for (const { name, source } of circuits) {
    test(`${name}: sample count and spacing metrics match baseline`, () => {
      const path = source.paths[0]!
      const ribbon = pathToRibbon(path, source.paths)
      expect(ribbon).not.toBeNull()
      const stats = baselineStats(ribbon!.ribbonPoints!)
      expect(stats).toMatchSnapshot()
    })
  }
})
