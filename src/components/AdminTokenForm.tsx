'use client'

import { useActionState } from 'react'
import { createAdminToken, type CreateTokenState } from '@/actions/admin-tokens'
import type { AdminApiScope } from '@/lib/admin-api-tokens'

export default function AdminTokenForm({ scopes }: { scopes: { value: AdminApiScope; label: string }[] }) {
  const [state, action, pending] = useActionState<CreateTokenState, FormData>(createAdminToken, {})
  return (
    <details className="card mb-6">
      <summary className="cursor-pointer text-sm font-semibold">Create API token</summary>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="label">Name</span>
            <input name="name" required maxLength={100} className="input w-64" placeholder="e.g. CI agent — catalog sync" />
          </label>
          <label className="text-sm">
            <span className="label">Expires in</span>
            <select name="expiresInDays" defaultValue="30" className="input w-auto">
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </label>
          <button disabled={pending} className="btn-primary">{pending ? '…' : 'Create token'}</button>
        </div>
        <fieldset>
          <legend className="label">Scopes</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {scopes.map((s) => (
              <label key={s.value} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="scopes"
                  value={s.value}
                  defaultChecked={s.value === 'read'}
                />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Write scopes do not imply read access — include Read if the token also needs GET endpoints.
          </p>
        </fieldset>
        {state.error && <p className="text-sm text-stop">{state.error}</p>}
        {state.ok && state.token && (
          <div className="rounded-lg border border-go/30 bg-go-soft px-4 py-3 text-sm">
            <p className="font-medium text-go">{state.ok}</p>
            <input
              readOnly
              value={state.token}
              onFocus={(e) => e.currentTarget.select()}
              aria-label="New API token"
              className="input mt-2 font-mono text-xs"
            />
          </div>
        )}
      </form>
    </details>
  )
}
