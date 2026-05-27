import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'

interface SubscriptionPayload {
  tier: string | null
  status: string | null
  currentPeriodEnd: string | null
}

interface MePayload {
  user: { id: string; email: string; name: string }
  subscription: SubscriptionPayload
}

async function fetchMe(): Promise<MePayload | null> {
  const res = await fetch('/api/me', { credentials: 'include' })
  if (!res.ok) return null
  return (await res.json()) as MePayload
}

async function postBilling(path: '/api/billing/checkout' | '/api/billing/portal', body?: unknown) {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  const data = (await res.json()) as { url?: string }
  if (!data.url) throw new Error('Missing url in response')
  return data.url
}

function AccountRoute() {
  const { session, isPending, client } = useAuth()
  const navigate = useNavigate()
  const me = Route.useLoaderData()
  const [billingError, setBillingError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isPending) {
    return (
      <div className='flex h-screen items-center justify-center bg-black/95 font-mono text-xs uppercase tracking-[0.3em] text-white/60'>
        Loading…
      </div>
    )
  }

  if (!session) {
    return (
      <div className='flex h-screen items-center justify-center bg-black/95'>
        <div className='flex max-w-sm flex-col items-center gap-4 p-8 text-center'>
          <p className='font-mono text-xs uppercase tracking-[0.3em] text-white/60'>
            Sign in to view your account.
          </p>
          <button
            type='button'
            onClick={() => navigate({ to: '/', search: { auth: 'signin' } })}
            className='rounded-sm border border-red-300/40 bg-red-500/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.3em] text-red-100 hover:border-red-300/80'
          >
            Open sign-in
          </button>
        </div>
      </div>
    )
  }

  const runBilling = async (op: () => Promise<string>) => {
    setBillingError(null)
    setSubmitting(true)
    try {
      const url = await op()
      window.location.assign(url)
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : 'Billing request failed')
    } finally {
      setSubmitting(false)
    }
  }

  const subscription = me?.subscription ?? null

  const handleSignOut = async () => {
    try {
      await client.signOut()
    } catch (err) {
      console.error('signOut failed', err)
    }
    navigate({ to: '/' })
  }

  return (
    <div className='min-h-screen bg-black/95 px-6 py-12 text-white/85'>
      <div className='mx-auto flex max-w-lg flex-col gap-8'>
        <header>
          <p className='font-mono text-[10px] uppercase tracking-[0.42em] text-red-300/80'>
            Account
          </p>
          <h1 className='mt-2 font-mono text-2xl font-semibold uppercase tracking-[0.12em] text-white'>
            {session.user.name}
          </h1>
          <p className='mt-1 font-mono text-xs text-white/55'>{session.user.email}</p>
        </header>

        <section className='flex flex-col gap-3'>
          <h2 className='font-mono text-[10px] uppercase tracking-[0.32em] text-white/55'>
            Subscription
          </h2>
          <div className='rounded-sm border border-white/10 bg-white/5 p-4 font-mono text-sm'>
            {subscription?.tier ? (
              <>
                <p>
                  Tier: <span className='text-red-200'>{subscription.tier}</span>
                </p>
                <p>Status: {subscription.status ?? '—'}</p>
                {subscription.currentPeriodEnd && (
                  <p className='text-xs text-white/55'>Renews {subscription.currentPeriodEnd}</p>
                )}
              </>
            ) : (
              <p>No active subscription.</p>
            )}
          </div>

          <div className='flex flex-col gap-2'>
            {!subscription?.tier && (
              <button
                type='button'
                onClick={() =>
                  runBilling(() => postBilling('/api/billing/checkout', { slug: 'pro-monthly' }))
                }
                disabled={submitting}
                className='rounded-sm border border-red-300/40 bg-red-500/15 px-3 py-2 font-mono text-xs uppercase tracking-[0.3em] text-red-100 hover:border-red-300/80 disabled:opacity-50'
              >
                {submitting ? 'Working…' : 'Upgrade to Pro'}
              </button>
            )}
            {subscription?.tier && (
              <button
                type='button'
                onClick={() => runBilling(() => postBilling('/api/billing/portal'))}
                disabled={submitting}
                className='rounded-sm border border-white/15 px-3 py-2 font-mono text-xs uppercase tracking-[0.3em] text-white/75 hover:border-red-300/60 disabled:opacity-50'
              >
                {submitting ? 'Working…' : 'Manage billing'}
              </button>
            )}
            {billingError && <p className='font-mono text-xs text-red-300/80'>{billingError}</p>}
          </div>
        </section>

        <section>
          <button
            type='button'
            onClick={handleSignOut}
            className='font-mono text-[10px] uppercase tracking-[0.3em] text-white/50 hover:text-white/85'
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/account')({
  component: AccountRoute,
  loader: () => fetchMe(),
})
