'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset, type ResetState } from '@/actions/password-reset'

export default function ForgotPage() {
  const [state, action, pending] = useActionState<ResetState, FormData>(requestPasswordReset, {})
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">Lupa Password</h1>
      <form action={action} className="space-y-4">
        <input name="email" type="email" required placeholder="Email" className="w-full rounded border px-3 py-2" />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.ok && <p className="text-sm text-green-700">{state.ok}</p>}
        <button disabled={pending} className="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {pending ? 'Mengirim…' : 'Kirim link reset'}
        </button>
      </form>
      <p className="mt-4 text-sm"><Link href="/auth/login" className="text-blue-600 underline">← Kembali ke login</Link></p>
    </main>
  )
}
