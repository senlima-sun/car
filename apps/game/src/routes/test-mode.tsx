import { createFileRoute } from '@tanstack/react-router'

function TestModeRoute() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-900 font-mono text-zinc-300">
      Test mode — coming soon
    </div>
  )
}

export const Route = createFileRoute('/test-mode')({ component: TestModeRoute })
