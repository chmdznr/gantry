'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { login } from '@/actions/login'
import { resendVerification } from '@/actions/signup'
import { BRAND } from '@/lib/brand'

function ResendForm() {
  const [state, action, pending] = useActionState(resendVerification, {})
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-muted">Tidak menerima email verifikasi?</summary>
      <form action={action} className="mt-2 flex gap-2">
        <input name="email" type="email" required placeholder="Email" className="input flex-1" />
        <button disabled={pending} className="btn-outline">
          {pending ? 'Mengirim…' : 'Kirim ulang'}
        </button>
      </form>
      {state.error && <p className="mt-1 text-stop">{state.error}</p>}
      {state.ok && <p className="mt-1 text-go">{state.ok}</p>}
    </details>
  )
}

function LoginForm() {
  const [state, action, pending] = useActionState(login, {})
  const params = useSearchParams()
  const verify = params.get('verify')
  const next = params.get('next') ?? ''
  return (
    <main className="page max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Masuk — {BRAND.name}</h1>
      {verify === 'ok' && <p className="mb-4 rounded bg-green-100 p-3 text-sm text-green-800">Email terverifikasi. Akun Anda menunggu persetujuan admin.</p>}
      {verify === 'invalid' && <p className="mb-4 rounded bg-red-100 p-3 text-sm text-red-800">Link verifikasi tidak valid atau kedaluwarsa.</p>}
      {params.get('reset') === 'ok' && <p className="mb-4 rounded bg-green-100 p-3 text-sm text-green-800">Password berhasil diubah. Silakan masuk.</p>}
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <input name="email" type="email" required placeholder="Email" className="input" />
        <input name="password" type="password" required placeholder="Password" className="input" />
        {state.error && <p className="text-sm text-stop">{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full">
          {pending ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
      <p className="mt-4 text-sm">Belum punya akun? <a href="/auth/signup" className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">Daftar</a></p>
      <p className="mt-2 text-sm"><a href="/auth/forgot" className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">Lupa password?</a></p>
      <ResendForm />
    </main>
  )
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
