'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { resetPassword, type ResetState } from '@/actions/password-reset'
import { useTranslations } from 'next-intl'

function ResetForm() {
  const t = useTranslations('auth')
  const [state, action, pending] = useActionState<ResetState, FormData>(resetPassword, {})
  const token = useSearchParams().get('token') ?? ''
  return (
    <main>
      <h1 className="mb-6 text-2xl font-bold">{t('resetTitle')}</h1>
      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <input name="password" type="password" required minLength={8} placeholder={t('newPassword')}
          className="input" />
        {state.error && <p className="text-sm text-stop">{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full">
          {pending ? t('saving') : t('saveNewPassword')}
        </button>
      </form>
    </main>
  )
}

export default function ResetPage() {
  return <Suspense><ResetForm /></Suspense>
}
