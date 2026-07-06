'use client'

import { useActionState } from 'react'
import { createApp, type ActionState } from '@/actions/apps'

export default function NewAppForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createApp, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Nama application</span>
        <input name="name" required minLength={3} className="rounded border px-3 py-2" placeholder="mis. Mobile App Tim X" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Deskripsi (opsional)</span>
        <input name="description" className="w-72 rounded border px-3 py-2" />
      </label>
      <button disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? 'Membuat…' : 'Buat Application'}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  )
}
