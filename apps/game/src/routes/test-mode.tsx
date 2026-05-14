import { createFileRoute } from '@tanstack/react-router'

function TestModeRoute() {
  return (
    <div className="flex h-screen items-center justify-center font-mono text-white">
      Test mode — coming soon
    </div>
  )
}

export const Route = createFileRoute('/test-mode')({ component: TestModeRoute })
