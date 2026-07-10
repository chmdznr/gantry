'use client'

import { useActionState } from 'react'
import { signup } from '@/actions/signup'
import CaptchaField from '@/components/CaptchaField'
import { useTranslations } from 'next-intl'

export default function SignupClient({ appName }: { appName: string }) {
  const t = useTranslations('auth')
  const [state, action, pending] = useActionState(signup, {})
  return (
    <main>
      <h1 className="mb-6 text-2xl font-bold">{t('signUpTitle', { brand: appName })}</h1>
      <form action={action} className="space-y-4">
        <input name="name" required placeholder={t('fullName')} className="input" />
        <input name="email" type="email" required placeholder={t('email')} className="input" />
        <input name="organization" placeholder={t('organization')} className="input" />
        <input name="password" type="password" required minLength={8} placeholder={t('passwordMin')} className="input" />
        <CaptchaField />
        {state.error && <p className="text-sm text-stop">{state.error}</p>}
        <button disabled={pending} className="btn-primary w-full">
          {pending ? t('processing') : t('signUp')}
        </button>
      </form>
      <p className="mt-4 text-sm">{t('haveAccount')} <a href="/auth/login" className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">{t('signIn')}</a></p>
    </main>
  )
}
