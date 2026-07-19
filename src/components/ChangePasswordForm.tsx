'use client'

import { useActionState } from 'react'
import { useTranslations } from 'next-intl'
import { changePassword } from '@/actions/change-password'

export default function ChangePasswordForm() {
  const t = useTranslations('account')
  const [state, action, pending] = useActionState(changePassword, {})

  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium">
        {t('currentPassword')}
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          className="input mt-1"
        />
      </label>
      <label className="block text-sm font-medium">
        {t('newPassword')}
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="input mt-1"
        />
      </label>
      <label className="block text-sm font-medium">
        {t('confirmPassword')}
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="input mt-1"
        />
      </label>
      {state.error && <p className="text-sm text-stop">{state.error}</p>}
      <button disabled={pending} className="btn-primary">
        {pending ? t('saving') : t('savePassword')}
      </button>
    </form>
  )
}
