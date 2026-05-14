import { lazy, Suspense } from 'react'

const DebugPanel = lazy(() => import('../../HUD/DebugPanel'))

export function DebugTab() {
  return (
    <div className='pointer-events-auto'>
      <Suspense fallback={<div className='text-white/50 text-sm'>Loading...</div>}>
        <DebugPanel />
      </Suspense>
    </div>
  )
}
