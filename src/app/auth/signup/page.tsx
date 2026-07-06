'use client'

import { useActionState } from 'react'
import { signup } from '@/actions/signup'
import CaptchaField from '@/components/CaptchaField'

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, {})
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="mb-6 text-2xl font-bold">Daftar — KAI API Developer Portal</h1>
      <form action={action} className="space-y-4">
        <input name="name" required placeholder="Nama lengkap" className="w-full rounded border px-3 py-2" />
        <input name="email" type="email" required placeholder="Email" className="w-full rounded border px-3 py-2" />
        <input name="organization" placeholder="Organisasi / perusahaan" className="w-full rounded border px-3 py-2" />
        <input name="password" type="password" required minLength={8} placeholder="Password (min 8 karakter)" className="w-full rounded border px-3 py-2" />
        <CaptchaField />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button disabled={pending} className="w-full rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {pending ? 'Memproses…' : 'Daftar'}
        </button>
      </form>
      <p className="mt-4 text-sm">Sudah punya akun? <a href="/auth/login" className="text-blue-600 underline">Masuk</a></p>
    </main>
  )
}
