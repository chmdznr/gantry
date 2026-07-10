'use client'

import { useActionState } from 'react'
import { adminCreateUser, type CreateUserState } from '@/actions/admin-users'

// Form admin membuatkan akun (mis. pengguna pemerintahan) — akun langsung
// active+verified; user mengatur password sendiri lewat invite link.
export default function NewUserForm() {
  const [state, action, pending] = useActionState<CreateUserState, FormData>(adminCreateUser, {})
  return (
    <details className="card mb-6">
      <summary className="cursor-pointer text-sm font-semibold">Create user (invite)</summary>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="label">Name</span>
          <input name="name" required minLength={3} className="input w-48" />
        </label>
        <label className="text-sm">
          <span className="label">Email</span>
          <input name="email" type="email" required className="input w-64" placeholder="user@instansi.go.id" />
        </label>
        <label className="text-sm">
          <span className="label">Organization</span>
          <input name="organization" className="input w-48" />
        </label>
        <label className="text-sm">
          <span className="label">Type</span>
          <select name="type" defaultValue="external" className="input w-auto">
            <option value="external">external</option>
            <option value="internal">internal</option>
          </select>
        </label>
        <button disabled={pending} className="btn-primary">{pending ? '…' : 'Create & invite'}</button>
        {state.error && <p className="w-full text-sm text-stop">{state.error}</p>}
        {state.ok && (
          <div className="w-full rounded-lg border border-go/30 bg-go-soft px-4 py-3 text-sm">
            <p className="font-medium text-go">{state.ok}</p>
            {state.inviteLink && (
              <>
                <p className="mt-2 text-ink-soft">
                  Set-password link (valid 3 days) — also emailed if SMTP is configured. Share it via an official channel:
                </p>
                <input
                  readOnly
                  value={state.inviteLink}
                  onFocus={(e) => e.currentTarget.select()}
                  className="input mt-1 font-mono text-xs"
                />
              </>
            )}
          </div>
        )}
      </form>
    </details>
  )
}
