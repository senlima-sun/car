import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { IS_DEV } from './utils/isDev'

if (IS_DEV) {
  import('./debug').then(({ initDevTools }) => initDevTools())
}

if ('serviceWorker' in navigator && !IS_DEV) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
  })
}

const App = lazy(() => import('./App'))
const TrackPreviewApp = lazy(() => import('./preview/TrackPreviewApp'))

const isTrackPreviewRoute = window.location.pathname.startsWith('/track-preview')
const Root = isTrackPreviewRoute ? TrackPreviewApp : App

function AppLoading() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1a1a2e',
        color: '#eee',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '1.25rem', marginBottom: 8 }}>Loading...</div>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<AppLoading />}>
      <Root />
    </Suspense>
  </StrictMode>,
)
