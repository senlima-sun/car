import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/track-preview')({
  component: () => <Outlet />,
})
