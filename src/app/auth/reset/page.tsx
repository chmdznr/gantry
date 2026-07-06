'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { resetPassword, type ResetState } from '@/actions/password-reset'

function ResetForm() {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {})
  const token = useSearchParams().get('token') ?? ''
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">Atur Ulang Password</h1>
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <input name="password" type="password" required minLength={8} placeholder="Password baru (min 8 karakter)"
          className="w-full rounded border px-3 py-2" />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {pending ? 'Menyimpan…' : 'Simpan password baru'}
        </button>
      </form>
    </main>
  )
}

export default function ResetPage() {
  return <Suspense><ResetForm /></Suspense>
}
