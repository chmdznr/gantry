'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset, type ResetState } from '@/actions/password-reset'

export default function ForgotPage() {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestPasswordReset, {})
  return (
    <main>
      <h1 className="mb-6 text-2xl font-bold">Lupa Password</h1>
      <form action={action} className="space-y-4">
        <input name="email" type="email" required placeholder="Email" className="input" />
        {state.error && <p className="text-sm text-stop">{state.error}</p>}
        {state.ok && <p className="text-sm text-go">{state.ok}</p>}
        <button disabled={pending} className="btn-primary w-full">
          {pending ? 'Mengirim…' : 'Kirim link reset'}
        </button>
      </form>
      <p className="mt-4 text-sm"><Link href="/auth/login" className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">← Kembali ke login</Link></p>
    </main>
  )
}
