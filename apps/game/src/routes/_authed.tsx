import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { fetchMe } from '@/auth/fetchEntitlements'

export const Route = createFileRoute('/_authed')({
  loader: async () => {
    const me = await fetchMe()
    if (!me) throw redirect({ to: '/', search: { auth: 'signin' } })
    return { me }
  },
  component: () => <Outlet />,
})
