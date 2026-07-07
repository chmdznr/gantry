'use client'

import { useActionState } from 'react'
import { createApp, type ActionState } from '@/actions/apps'

export default function NewAppForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createApp, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-muted">Nama application</span>
        <input name="name" required minLength={3} className="input w-auto" placeholder="mis. Mobile App Tim X" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-muted">Deskripsi (opsional)</span>
        <input name="description" className="input w-72" />
      </label>
      <button disabled={pending} className="btn-primary">
        {pending ? 'Membuat…' : 'Buat Application'}
      </button>
      {state.error && <p className="w-full text-sm text-stop">{state.error}</p>}
    </form>
  )
}
