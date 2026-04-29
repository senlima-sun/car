import { describe, expect, it } from 'bun:test'
import { shouldEnableSkyEnvironment } from './HdriSky'

describe('shouldEnableSkyEnvironment', () => {
  it('keeps environment enabled until fps drops below the disable threshold', () => {
    expect(shouldEnableSkyEnvironment(80, true)).toBe(true)
    expect(shouldEnableSkyEnvironment(74, true)).toBe(false)
  })

  it('keeps environment disabled until fps recovers above the enable threshold', () => {
    expect(shouldEnableSkyEnvironment(90, false)).toBe(false)
    expect(shouldEnableSkyEnvironment(96, false)).toBe(true)
  })
})
