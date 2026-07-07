'use client'

import { useActionState } from 'react'
import { createCredential, type SecretState } from '@/actions/apps'
import { useTranslations } from 'next-intl'

export default function CredentialCreator({ appId }: { appId: string }) {
  const t = useTranslations('apps')
  const [state, action, pending] = useActionState<SecretState, FormData>(createCredential, {})
  return (
    <div className="card">
      <form action={action} className="flex items-end gap-3">
        <input type="hidden" name="appId" value={appId} />
        <label className="text-sm">
          <span className="mb-1 block text-muted">{t('credType')}</span>
          <select name="type" className="input w-auto">
            <option value="key-auth">API Key</option>
            <option value="jwt">JWT</option>
          </select>
        </label>
        <button disabled={pending} className="btn-primary">
          {pending ? t('creating') : t('generate')}
        </button>
      </form>
      {state.error && <p className="mt-2 text-sm text-stop">{state.error}</p>}
      {state.secret && (
        <div className="mt-3 rounded bg-warn-soft p-3 text-sm">
          <p className="mb-2 font-semibold text-warn">
            {t('saveNow')}
          </p>
          {state.secret.type === 'key-auth' ? (
            <p>{t('apiKey')}: <code className="select-all rounded bg-surface px-2 py-0.5">{state.secret.key}</code></p>
          ) : (
            <>
              <p>{t('jwtKey')} <code className="select-all rounded bg-surface px-2 py-0.5">{state.secret.key}</code></p>
              <p className="mt-1">{t('jwtSecret')} <code className="select-all rounded bg-surface px-2 py-0.5">{state.secret.jwtSecret}</code></p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
