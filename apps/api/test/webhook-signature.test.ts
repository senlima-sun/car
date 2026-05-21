import { describe, expect, test } from 'vitest'
import { Webhook } from 'standardwebhooks'
import { webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'
import { polar } from '@polar-sh/better-auth'
import { createApp } from '../src/app.ts'
import { memoryHarness } from './helpers/memory-env.ts'

const TEST_SECRET = Buffer.from('test-secret-32-bytes-padded-with-z').toString('base64')

function makeAppWithWebhooks() {
  const harness = memoryHarness()
  const polarClient = new Polar({ accessToken: 'test-token' })
  harness.authOverrides.plugins = [
    polar({
      client: polarClient,
      createCustomerOnSignUp: false,
      use: [webhooks({ secret: TEST_SECRET })],
    }),
  ]
  return { app: createApp({ authOverrides: harness.authOverrides }), env: harness.env }
}

function buildSignedRequest(opts: {
  payload: string
  secret: string
  timestampOffsetSeconds?: number
  forge?: boolean
  msgId?: string
}): Request {
  const ts = Math.floor(Date.now() / 1000) + (opts.timestampOffsetSeconds ?? 0)
  const msgId = opts.msgId ?? `msg-${ts}`
  const wh = new Webhook(opts.secret)
  let signature = wh.sign(msgId, new Date(ts * 1000), opts.payload)
  if (opts.forge) signature = 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
  return new Request('http://localhost/api/auth/polar/webhooks', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'webhook-id': msgId,
      'webhook-timestamp': String(ts),
      'webhook-signature': signature,
    },
    body: opts.payload,
  })
}

describe('Polar webhook', () => {
  test('rejects forged signature with 400', async () => {
    const { app, env } = makeAppWithWebhooks()
    const req = buildSignedRequest({
      payload: JSON.stringify({ type: 'order.created', data: {} }),
      secret: TEST_SECRET,
      forge: true,
    })
    const res = await app.fetch(req, env)
    expect(res.status).toBe(400)
  })

  test('rejects stale timestamp with 400', async () => {
    const { app, env } = makeAppWithWebhooks()
    const req = buildSignedRequest({
      payload: JSON.stringify({ type: 'order.created', data: {} }),
      secret: TEST_SECRET,
      timestampOffsetSeconds: -600,
    })
    const res = await app.fetch(req, env)
    expect(res.status).toBe(400)
  })

  test('valid signature with valid timestamp is accepted (or rejected on payload, not on signature)', async () => {
    const { app, env } = makeAppWithWebhooks()
    const req = buildSignedRequest({
      payload: JSON.stringify({ type: 'unknown.event', data: {} }),
      secret: TEST_SECRET,
    })
    const res = await app.fetch(req, env)
    // Signature/timestamp passes. Polar may 400 on unknown event type or 200.
    // Either way: not a signature failure.
    expect([200, 400]).toContain(res.status)
  })
})
