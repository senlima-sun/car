import { useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { AuthForm } from './AuthForm'

type ModalMode = 'signin' | 'signup' | null

function readAuthSearchParam(): ModalMode {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('auth')
  return value === 'signin' || value === 'signup' ? value : null
}

interface AuthMenuButtonProps {
  initialOpen?: ModalMode
  onClose?: () => void
}

export function AuthMenuButton({ initialOpen, onClose }: AuthMenuButtonProps) {
  const { session, client } = useAuth()
  const [modal, setModal] = useState<ModalMode>(() => initialOpen ?? readAuthSearchParam())

  const closeModal = () => {
    setModal(null)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.has('auth')) {
        url.searchParams.delete('auth')
        window.history.replaceState(null, '', url.toString())
      }
    }
    onClose?.()
  }

  if (session) {
    return (
      <div className='flex items-center justify-between gap-3 border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/55'>
        <span className='truncate text-white/70'>{session.user.email}</span>
        <button
          type='button'
          onClick={() => client.signOut()}
          className='rounded-sm border border-white/15 px-2.5 py-1 hover:border-red-300/60 hover:text-red-100'
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className='border-t border-white/10 pt-3'>
      <button
        type='button'
        onClick={() => setModal('signin')}
        className='w-full rounded-sm border border-white/15 py-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/65 hover:border-red-300/60 hover:text-white/90'
      >
        Sign in · Sign up
      </button>

      {modal !== null && (
        <div
          className='fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur'
          role='dialog'
          aria-modal='true'
        >
          <div className='relative w-full max-w-sm rounded-sm border border-white/10 bg-black/90 p-6'>
            <button
              type='button'
              onClick={closeModal}
              aria-label='Close'
              className='absolute right-3 top-3 font-mono text-xs text-white/40 hover:text-white/80'
            >
              ✕
            </button>
            <h2 className='mb-4 font-mono text-xs uppercase tracking-[0.32em] text-white/70'>
              {modal === 'signup' ? 'Create account' : 'Sign in'}
            </h2>
            <AuthForm
              mode={modal}
              onSwitchMode={setModal}
              onSuccess={closeModal}
            />
          </div>
        </div>
      )}
    </div>
  )
}
