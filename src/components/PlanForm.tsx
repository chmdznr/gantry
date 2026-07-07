'use client'

import { useActionState } from 'react'
import { createPlan, type ActionState } from '@/actions/admin-plans'

export default function PlanForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPlan, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-muted">Name</span>
        <input name="name" required className="input w-32" placeholder="Gold" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-muted">Description</span>
        <input name="description" className="input w-56" />
      </label>
      {(['second', 'minute', 'hour', 'day'] as const).map((k) => (
        <label key={k} className="text-sm">
          <span className="mb-1 block text-muted">/{k}</span>
          <input name={k} type="number" min={0} className="input w-24" />
        </label>
      ))}
      <button disabled={pending} className="btn-primary">
        {pending ? 'Menyimpan…' : 'Tambah Plan'}
      </button>
      {state.error && <p className="w-full text-sm text-stop">{state.error}</p>}
    </form>
  )
}
