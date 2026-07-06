'use client'

import { useActionState } from 'react'
import { createPlan, type ActionState } from '@/actions/admin-plans'

export default function PlanForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPlan, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Nama</span>
        <input name="name" required className="w-32 rounded border px-3 py-2" placeholder="Gold" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Deskripsi</span>
        <input name="description" className="w-56 rounded border px-3 py-2" />
      </label>
      {(['second', 'minute', 'hour', 'day'] as const).map((k) => (
        <label key={k} className="text-sm">
          <span className="mb-1 block text-gray-600">/{k}</span>
          <input name={k} type="number" min={0} className="w-24 rounded border px-3 py-2" />
        </label>
      ))}
      <button disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? 'Menyimpan…' : 'Tambah Plan'}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  )
}
