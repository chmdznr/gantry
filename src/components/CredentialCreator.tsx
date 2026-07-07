'use client'

import { useActionState } from 'react'
import { createCredential, type SecretState } from '@/actions/apps'

export default function CredentialCreator({ appId }: { appId: string }) {
  const [state, action, pending] = useActionState<SecretState, FormData>(createCredential, {})
  return (
    <div className="card">
      <form action={action} className="flex items-end gap-3">
        <input type="hidden" name="appId" value={appId} />
        <label className="text-sm">
          <span className="mb-1 block text-muted">Tipe credential</span>
          <select name="type" className="input w-auto">
            <option value="key-auth">API Key</option>
            <option value="jwt">JWT</option>
          </select>
        </label>
        <button disabled={pending} className="btn-primary">
          {pending ? 'Membuat…' : 'Generate'}
        </button>
      </form>
      {state.error && <p className="mt-2 text-sm text-stop">{state.error}</p>}
      {state.secret && (
        <div className="mt-3 rounded bg-warn-soft p-3 text-sm">
          <p className="mb-2 font-semibold text-warn">
            ⚠️ Simpan sekarang — secret ini hanya ditampilkan sekali dan tidak disimpan portal.
          </p>
          {state.secret.type === 'key-auth' ? (
            <p>API Key: <code className="select-all rounded bg-surface px-2 py-0.5">{state.secret.key}</code></p>
          ) : (
            <>
              <p>JWT key (iss): <code className="select-all rounded bg-surface px-2 py-0.5">{state.secret.key}</code></p>
              <p className="mt-1">JWT secret: <code className="select-all rounded bg-surface px-2 py-0.5">{state.secret.jwtSecret}</code></p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
