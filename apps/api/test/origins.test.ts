import { describe, expect, test } from 'bun:test'
import { parseOrigins } from '../src/auth/origins.ts'

describe('parseOrigins', () => {
  test('splits comma-separated origins', () => {
    expect(parseOrigins({ FRONTEND_ORIGINS: 'https://a,https://b' })).toEqual([
      'https://a',
      'https://b',
    ])
  })

  test('trims whitespace and drops empties', () => {
    expect(parseOrigins({ FRONTEND_ORIGINS: ' https://a , , https://b , ' })).toEqual([
      'https://a',
      'https://b',
    ])
  })

  test('throws on empty after trimming', () => {
    expect(() => parseOrigins({ FRONTEND_ORIGINS: ' , , ' })).toThrow(/FRONTEND_ORIGINS/)
  })

  test('throws on empty string', () => {
    expect(() => parseOrigins({ FRONTEND_ORIGINS: '' })).toThrow()
  })
})
