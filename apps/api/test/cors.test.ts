import { describe, expect, test } from 'bun:test'
import app from '../src/index.ts'
import { memoryEnv } from './helpers/memory-env.ts'

describe('CORS', () => {
  test('echoes ACAO for allowed origin', async () => {
    const env = memoryEnv()
    const res = await app.request(
      '/api/health',
      { headers: { Origin: 'http://localhost:7234' } },
      env,
    )
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:7234')
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')
    expect(res.headers.get('vary')).toContain('Origin')
  })

  test('rejects unknown origin', async () => {
    const env = memoryEnv()
    const res = await app.request(
      '/api/health',
      { headers: { Origin: 'http://evil.example' } },
      env,
    )
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  test('preflight returns 204 with max-age', async () => {
    const env = memoryEnv()
    const res = await app.request(
      '/api/auth/sign-in/email',
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:7234',
          'access-control-request-method': 'POST',
          'access-control-request-headers': 'content-type',
        },
      },
      env,
    )
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-max-age')).toBe('600')
    expect(res.headers.get('access-control-allow-credentials')).toBe('true')
  })
})
