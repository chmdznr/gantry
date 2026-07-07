'use client'

import { useActionState } from 'react'
import { signup } from '@/actions/signup'
import CaptchaField from '@/components/CaptchaField'
import { BRAND } from '@/lib/brand'

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, {})
  return (
    <main className="page max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Daftar — {BRAND.name}</h1>
      <form action={action} className="space-y-4">
        <input name="name" required placeholder="Nama lengkap" className="input" />
        <input name="email" type="email" required placeholder="Email" className="input" />
        <input name="organization" placeholder="Organisasi / perusahaan" className="input" />
        <input name="password" type="password" required minLength={8} placeholder="Password (min 8 karakter)" className="input" />
        <CaptchaField />
        {state.error && <p className="text-sm text-stop">{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full">
          {pending ? 'Memproses…' : 'Daftar'}
        </button>
      </form>
      <p className="mt-4 text-sm">Sudah punya akun? <a href="/auth/login" className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">Masuk</a></p>
    </main>
  )
}
