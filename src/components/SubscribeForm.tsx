'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestSubscription, type ActionState } from '@/actions/subscriptions'

type Option = { id: string; name: string }

export default function SubscribeForm({ productId, apps, plans, hasApps }: {
  productId: string
  apps: Option[]
  plans: (Option & { limits: string })[]
  hasApps: boolean
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestSubscription, {})
  if (apps.length === 0) {
    return hasApps
      ? <p className="text-sm text-muted">Semua application Anda sudah memiliki subscription untuk API ini.</p>
      : <p className="text-sm text-muted">Buat <Link href="/apps" className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">application</Link> dulu untuk subscribe.</p>
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="productId" value={productId} />
      <label className="text-sm">
        <span className="mb-1 block text-muted">Application</span>
        <select name="appId" required className="input w-auto">
          {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-muted">Plan</span>
        <select name="planId" required className="input w-auto">
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.limits})</option>)}
        </select>
      </label>
      <button disabled={pending} className="btn-primary">
        {pending ? 'Memproses…' : 'Subscribe'}
      </button>
      {state.error && <p className="w-full text-sm text-stop">{state.error}</p>}
      {state.ok && <p className="w-full text-sm text-go">{state.ok}</p>}
    </form>
  )
}
