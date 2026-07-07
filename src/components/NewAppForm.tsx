'use client'

import { useActionState } from 'react'
import { createApp, type ActionState } from '@/actions/apps'
import { useTranslations } from 'next-intl'

export default function NewAppForm() {
  const t = useTranslations('apps')
  const [state, action, pending] = useActionState<ActionState, FormData>(createApp, {})
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">
        <span className="mb-1 block text-muted">{t('nameLabel')}</span>
        <input name="name" required minLength={3} className="input w-auto" placeholder={t('namePlaceholder')} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block text-muted">{t('descLabel')}</span>
        <input name="description" className="input w-72" />
      </label>
      <button disabled={pending} className="btn-primary">
        {pending ? t('creating') : t('create')}
      </button>
      {state.error && <p className="w-full text-sm text-stop">{state.error}</p>}
    </form>
  )
}
