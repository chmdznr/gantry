import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { applications } from '@/db/schema'
import NewAppForm from '@/components/NewAppForm'
import { getTranslations } from 'next-intl/server'

export default async function AppsPage() {
  const t = await getTranslations()
  const session = await auth()
  if (!session?.user) redirect('/auth/login')
  const apps = await db.select().from(applications)
    .where(eq(applications.ownerUserId, session.user.id))
    .orderBy(desc(applications.createdAt))

  return (
    <main className="page">
      <Link href="/" className="text-sm font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">{t('catalog.backToCatalog')}</Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">{t('apps.title')}</h1>
      <div className="mb-8"><NewAppForm /></div>
      {apps.length === 0 ? (
        <p className="text-muted">{t('apps.empty')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {apps.map((a) => (
            <Link key={a.id} href={`/apps/${a.id}`} className="card-hover">
              <h3 className="font-semibold">{a.name}</h3>
              <p className="mt-1 text-sm text-muted">{a.description || '—'}</p>
              <p className="mt-2 font-mono text-xs text-muted">{a.kongConsumerUsername}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
