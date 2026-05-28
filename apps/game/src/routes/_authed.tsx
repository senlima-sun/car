import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { fetchMe } from '@/auth/fetchEntitlements'

export const Route = createFileRoute('/_authed')({
  loader: async () => {
    const me = await fetchMe().catch(() => null)
    if (!me) throw redirect({ to: '/', search: { auth: 'signin' } })
    return { me }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const { me } = Route.useLoaderData()
  return (
    <AuthProvider me={me}>
      <Outlet />
    </AuthProvider>
  )
}
