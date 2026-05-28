import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { PRICING_PRODUCTS } from '@/auth/pricingProducts'
import { useAuth } from '@/auth/AuthProvider'
import { fetchMe } from '@/auth/fetchEntitlements'

const UPGRADE_FEATURE_LABELS: Record<string, string> = {
  race: 'Race Mode',
  editor: 'Track Editor',
  timeTrial: 'Time Trial',
  showroomFull: 'Full Showroom Customization',
  telemetryExport: 'Telemetry Export',
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
  const { session, client } = useAuth()
  const navigate = useNavigate()
  const me = Route.useLoaderData()
  const { upgrade } = Route.useSearch()
  const [billingError, setBillingError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const subscription = me?.subscription ?? null

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
            {session?.user.name}
          </h1>
          <p className='mt-1 font-mono text-xs text-white/55'>{session?.user.email}</p>
        </header>

        {upgrade && !subscription?.tier && (
          <div className='rounded-sm border border-red-300/30 bg-red-500/10 px-4 py-3 font-mono text-xs text-red-200'>
            Upgrade to Pro to unlock {UPGRADE_FEATURE_LABELS[upgrade] ?? upgrade}.
          </div>
        )}

        <section className='flex flex-col gap-3'>
          <h2 className='font-mono text-[10px] uppercase tracking-[0.32em] text-white/55'>
            Subscription
          </h2>

          {subscription?.tier ? (
            <>
              <div className='rounded-sm border border-white/10 bg-white/5 p-4 font-mono text-sm'>
                <p>
                  Tier: <span className='text-red-200'>{subscription.tier}</span>
                </p>
                <p>Status: {subscription.status ?? '—'}</p>
                {subscription.currentPeriodEnd && (
                  <p className='text-xs text-white/55'>Renews {subscription.currentPeriodEnd}</p>
                )}
              </div>
              <button
                type='button'
                onClick={() => runBilling(() => postBilling('/api/billing/portal'))}
                disabled={submitting}
                className='rounded-sm border border-white/15 px-3 py-2 font-mono text-xs uppercase tracking-[0.3em] text-white/75 hover:border-red-300/60 disabled:opacity-50'
              >
                {submitting ? 'Working…' : 'Manage billing'}
              </button>
            </>
          ) : (
            <div className='flex flex-col gap-3 sm:flex-row'>
              {PRICING_PRODUCTS.map(product => (
                <div
                  key={product.slug}
                  className='flex flex-1 flex-col gap-3 rounded-sm border border-white/10 bg-white/5 p-4'
                >
                  <div>
                    <p className='font-mono text-[10px] uppercase tracking-[0.3em] text-white/55'>
                      Pro · {product.billingCycle}
                    </p>
                    <p className='mt-1 font-mono text-xl font-semibold text-white'>
                      {product.displayPrice}
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() =>
                      runBilling(() =>
                        postBilling('/api/billing/checkout', { slug: product.slug }),
                      )
                    }
                    disabled={submitting}
                    className='rounded-sm border border-red-300/40 bg-red-500/15 px-3 py-2 font-mono text-xs uppercase tracking-[0.3em] text-red-100 hover:border-red-300/80 disabled:opacity-50'
                  >
                    {submitting ? 'Working…' : 'Get Pro'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {billingError && (
            <p className='font-mono text-xs text-red-300/80'>{billingError}</p>
          )}
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

export const Route = createFileRoute('/_authed/account')({
  component: AccountRoute,
  validateSearch: (s: Record<string, unknown>): { upgrade?: 'race' | 'editor' | 'timeTrial' | 'showroomFull' | 'telemetryExport' } => {
    const valid = ['race', 'editor', 'timeTrial', 'showroomFull', 'telemetryExport'] as const
    const upgrade = s['upgrade']
    return upgrade && (valid as readonly string[]).includes(upgrade as string)
      ? { upgrade: upgrade as typeof valid[number] }
      : {}
  },
  loader: () => fetchMe(),
})
