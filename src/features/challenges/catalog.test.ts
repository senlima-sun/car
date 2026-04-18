import { describe, expect, test } from 'bun:test'
import { BUILTIN_CHALLENGES, classifyLapTime } from './catalog'

describe('classifyLapTime', () => {
  test('returns gold when at-or-under gold threshold', () => {
    const ch = BUILTIN_CHALLENGES[0]
    expect(classifyLapTime(ch, ch.medals.gold - 1)).toBe('gold')
  })

  test('returns silver between gold and silver', () => {
    const ch = BUILTIN_CHALLENGES[0]
    expect(classifyLapTime(ch, ch.medals.silver - 1)).toBe('silver')
  })

  test('returns null when slower than bronze', () => {
    const ch = BUILTIN_CHALLENGES[0]
    expect(classifyLapTime(ch, ch.medals.bronze + 1000)).toBeNull()
  })
})
