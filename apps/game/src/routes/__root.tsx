import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthProvider } from '../auth/AuthProvider'

export const Route = createRootRoute({
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
})
