'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { login } from '@/actions/login'
import { resendVerification } from '@/actions/signup'

function ResendForm() {
  const [state, action, pending] = useActionState(resendVerification, {})
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-gray-600">Tidak menerima email verifikasi?</summary>
      <form action={action} className="mt-2 flex gap-2">
        <input name="email" type="email" required placeholder="Email" className="flex-1 rounded border px-3 py-2" />
        <button disabled={pending} className="rounded border px-3 py-2 disabled:opacity-50">
          {pending ? 'Mengirim…' : 'Kirim ulang'}
        </button>
      </form>
      {state.error && <p className="mt-1 text-red-600">{state.error}</p>}
      {state.ok && <p className="mt-1 text-green-700">{state.ok}</p>}
    </details>
  )
}

function LoginForm() {
  const [state, action, pending] = useActionState(login, {})
  const params = useSearchParams()
  const verify = params.get('verify')
  const next = params.get('next') ?? ''
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">Masuk — KAI API Developer Portal</h1>
      {verify === 'ok' && <p className="mb-4 rounded bg-green-100 p-3 text-sm text-green-800">Email terverifikasi. Akun Anda menunggu persetujuan admin.</p>}
      {verify === 'invalid' && <p className="mb-4 rounded bg-red-100 p-3 text-sm text-red-800">Link verifikasi tidak valid atau kedaluwarsa.</p>}
      {params.get('reset') === 'ok' && <p className="mb-4 rounded bg-green-100 p-3 text-sm text-green-800">Password berhasil diubah. Silakan masuk.</p>}
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input name="email" type="email" required placeholder="Email" className="w-full rounded border px-3 py-2" />
        <input name="password" type="password" required placeholder="Password" className="w-full rounded border px-3 py-2" />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {pending ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
      <p className="mt-4 text-sm">Belum punya akun? <a href="/auth/signup" className="text-blue-600 underline">Daftar</a></p>
      <p className="mt-2 text-sm"><a href="/auth/forgot" className="text-blue-600 underline">Lupa password?</a></p>
      <ResendForm />
    </main>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
