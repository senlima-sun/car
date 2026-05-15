import { useState } from 'react'
import { authClient } from '@/auth/client'

type Mode = 'signin' | 'signup'

interface AuthFormProps {
  mode: Mode
  onSwitchMode: (mode: Mode) => void
  onSuccess?: () => void
}

export function AuthForm({ mode, onSwitchMode, onSuccess }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setErrorMessage(null)
    setSubmitting(true)
    try {
      if (mode === 'signup') {
        const res = await authClient.signUp.email({ email, password, name })
        if (res.error) throw new Error(res.error.message ?? 'Sign-up failed')
      } else {
        const res = await authClient.signIn.email({ email, password })
        if (res.error) throw new Error(res.error.message ?? 'Sign-in failed')
      }
      onSuccess?.()
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const isSignUp = mode === 'signup'

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
      {isSignUp && (
        <label className='flex flex-col gap-1 text-[10px] uppercase tracking-[0.3em] text-white/60'>
          Name
          <input
            type='text'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete='name'
            className='rounded-sm border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white/90 outline-none focus:border-red-300/70'
          />
        </label>
      )}
      <label className='flex flex-col gap-1 text-[10px] uppercase tracking-[0.3em] text-white/60'>
        Email
        <input
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete='email'
          className='rounded-sm border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white/90 outline-none focus:border-red-300/70'
        />
      </label>
      <label className='flex flex-col gap-1 text-[10px] uppercase tracking-[0.3em] text-white/60'>
        Password
        <input
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          className='rounded-sm border border-white/15 bg-black/40 px-3 py-2 font-mono text-sm text-white/90 outline-none focus:border-red-300/70'
        />
      </label>

      {errorMessage && (
        <p className='font-mono text-xs text-red-300/90'>{errorMessage}</p>
      )}

      <button
        type='submit'
        disabled={submitting}
        className='mt-2 rounded-sm border border-red-300/40 bg-red-500/15 px-3 py-2 font-mono text-xs uppercase tracking-[0.3em] text-red-100 hover:border-red-300/80 disabled:opacity-50'
      >
        {submitting ? 'Working…' : isSignUp ? 'Create account' : 'Sign in'}
      </button>

      <button
        type='button'
        onClick={() => onSwitchMode(isSignUp ? 'signin' : 'signup')}
        className='font-mono text-[10px] uppercase tracking-[0.3em] text-white/50 hover:text-white/80'
      >
        {isSignUp ? 'Have an account? Sign in' : "New here? Create an account"}
      </button>
    </form>
  )
}
