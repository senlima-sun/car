import { useState } from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import { useAuth } from '@/auth/AuthProvider'
import { AuthForm } from './AuthForm'

type ModalMode = 'signin' | 'signup' | null

function readAuthSearchParam(): ModalMode {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('auth')
  return value === 'signin' || value === 'signup' ? value : null
}

function clearAuthSearchParam() {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has('auth')) return
  url.searchParams.delete('auth')
  window.history.replaceState(null, '', url.toString())
}

interface AuthMenuButtonProps {
  initialOpen?: ModalMode
}

export function AuthMenuButton({ initialOpen }: AuthMenuButtonProps) {
  const { session, client } = useAuth()
  const [modal, setModal] = useState<ModalMode>(() => initialOpen ?? readAuthSearchParam())

  const handleSignOut = async () => {
    try {
      await client.signOut()
    } catch (err) {
      console.error('signOut failed', err)
    }
  }

  if (session) {
    return (
      <div className='flex items-center justify-between gap-3 border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/55'>
        <span className='truncate text-white/70'>{session.user.email}</span>
        <button
          type='button'
          onClick={handleSignOut}
          className='rounded-sm border border-white/15 px-2.5 py-1 hover:border-red-300/60 hover:text-red-100'
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className='border-t border-white/10 pt-3'>
      <Dialog.Root
        open={modal !== null}
        onOpenChange={open => {
          if (!open) {
            setModal(null)
            clearAuthSearchParam()
          }
        }}
      >
        <Dialog.Trigger
          render={props => (
            <button
              {...props}
              type='button'
              onClick={() => setModal('signin')}
              className='w-full rounded-sm border border-white/15 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/65 hover:border-red-300/60 hover:text-white/90'
            >
              Sign in · Sign up
            </button>
          )}
        />
        <Dialog.Portal>
          <Dialog.Backdrop className='fixed inset-0 z-1000 bg-black/70 backdrop-blur' />
          <Dialog.Popup className='fixed top-1/2 left-1/2 z-1001 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white/10 bg-black/90 p-6 pointer-events-auto'>
            <Dialog.Title className='mb-4 font-mono text-xs uppercase tracking-[0.32em] text-white/70'>
              {modal === 'signup' ? 'Create account' : 'Sign in'}
            </Dialog.Title>
            {modal !== null && (
              <AuthForm
                mode={modal}
                onSwitchMode={setModal}
                onSuccess={() => {
                  setModal(null)
                  clearAuthSearchParam()
                }}
              />
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
