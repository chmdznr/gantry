import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { passwordResetTokens } from '@/db/schema'
import ResetClient from './ResetClient'

// Validasi token saat load — jangan biarkan user mengisi form yang pasti gagal.
export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams
  const t = await getTranslations('auth')
  const row = token
    ? await db.query.passwordResetTokens.findFirst({ where: eq(passwordResetTokens.token, token) })
    : null
  if (!row || row.expiresAt < new Date()) {
    return (
      <main>
        <h1 className="mb-6 text-2xl font-bold">{t('resetTitle')}</h1>
        <p className="text-sm text-stop">{t('resetLinkInvalid')}</p>
        <Link href="/auth/forgot" className="mt-4 inline-block text-sm font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">
          {t('requestNewLink')}
        </Link>
      </main>
    )
  }
  return <ResetClient token={token!} />
}
