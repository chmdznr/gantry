import { getTranslations } from 'next-intl/server'

export default async function SignupSuccessPage() {
  const t = await getTranslations('auth')
  return (
    <main className="text-center">
      <h1 className="mb-4 text-2xl font-bold">{t('checkEmailTitle')}</h1>
      <p>{t('checkEmailText')}</p>
    </main>
  )
}
