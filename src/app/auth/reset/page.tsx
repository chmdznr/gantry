'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { resetPassword, type ResetState } from '@/actions/password-reset'

function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {})
  const token = useSearchParams().get('token') ?? ''
  return (
    <main className="page max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Atur Ulang Password</h1>
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <input name="password" type="password" required minLength={8} placeholder="Password baru (min 8 karakter)"
          className="input" />
        {state.error && <p className="text-sm text-stop">{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full">
          {pending ? 'Menyimpan…' : 'Simpan password baru'}
        </button>
      </form>
    </main>
  )
}

export default function ResetPage() {
  return <Suspense><ResetForm /></Suspense>
}
