'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestSubscription, type ActionState } from '@/actions/subscriptions'

type Option = { id: string; name: string }

export default function SubscribeForm({ productId, apps, plans }: {
  productId: string
  apps: Option[]
  plans: (Option & { limits: string })[]
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestSubscription, {})
  if (apps.length === 0) {
    return <p className="text-sm text-gray-600">Buat <Link href="/apps" className="text-blue-600 underline">application</Link> dulu untuk subscribe.</p>
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="productId" value={productId} />
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Application</span>
        <select name="appId" required className="rounded border px-3 py-2">
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-gray-600">Plan</span>
        <select name="planId" required className="rounded border px-3 py-2">
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.limits})</option>)}
        </select>
      </label>
      <button disabled={pending} className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? 'Memproses…' : 'Subscribe'}
      </button>
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="w-full text-sm text-green-700">{state.ok}</p>}
    </form>
  )
}
