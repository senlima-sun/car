import { createFileRoute, redirect } from '@tanstack/react-router'
import App from '@/App'
import { postRaceStart } from '@/auth/fetchEntitlements'
import { useSyncGameStatus } from '../-useSyncGameStatus'

interface RaceSearch {
  forcedDaily?: string
}

function RaceRoute() {
  useSyncGameStatus('session')
  const { forcedDaily } = Route.useSearch()
  return (
    <>
      {forcedDaily === '1' && (
        <div className='pointer-events-none absolute left-1/2 top-6 z-50 -translate-x-1/2 rounded-sm border border-red-300/40 bg-red-500/15 px-4 py-2 font-mono text-xs uppercase tracking-[0.3em] text-red-100'>
          Today&apos;s free track for your tier — enjoy!
        </div>
      )}
      <App />
    </>
  )
}

export const Route = createFileRoute('/_authed/race/$trackId')({
  validateSearch: (search: Record<string, unknown>): RaceSearch => ({
    forcedDaily: typeof search.forcedDaily === 'string' ? search.forcedDaily : undefined,
  }),
  loader: async ({ params }) => {
    const verdict = await postRaceStart(params.trackId)
    if (verdict === null) throw redirect({ to: '/', search: { auth: 'signin' } })
    if ('error' in verdict && verdict.error === 'pro_required') {
      console.log(JSON.stringify({ event: 'race.gate.upgrade_required' }))
      throw redirect({ to: '/account', search: { upgrade: 'race' } })
    }
    if ('redirect' in verdict) {
      throw redirect({
        to: '/race/$trackId',
        params: { trackId: verdict.redirect },
        search: { forcedDaily: '1' },
      })
    }
    return { grantedTrackId: ('grantedTrackId' in verdict ? verdict.grantedTrackId : null) ?? null }
  },
  component: RaceRoute,
})
