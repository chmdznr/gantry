import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import ChangePasswordForm from '@/components/ChangePasswordForm'

export default async function SecurityPage() {
  if (!(await auth())?.user) redirect('/auth/login')
  const t = await getTranslations('account')

  return (
    <main className="page">
      <h1 className="mb-2 text-2xl font-bold">{t('securityTitle')}</h1>
      <p className="mb-6 text-sm text-muted">{t('securityText')}</p>
      <div className="card max-w-lg">
        <ChangePasswordForm />
      </div>
    </main>
  )
}
