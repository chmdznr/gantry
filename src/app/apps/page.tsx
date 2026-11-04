import Link from 'next/link'
import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { appCredentials, applications, subscriptions } from '@/db/schema'
import NewAppForm from '@/components/NewAppForm'
import { getTranslations } from 'next-intl/server'
import Pagination from '@/components/Pagination'
import { resolvePagination, type PageSearchParams } from '@/lib/pagination'

export default async function AppsPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const t = await getTranslations()
  const session = await auth()
  if (!session?.user) redirect('/auth/login')
  const sp = await searchParams

  const totalRows = await db.select({ n: count() }).from(applications)
    .where(eq(applications.ownerUserId, session.user.id))
  const total = Number(totalRows[0]?.n ?? 0)
  const { page, pageSize, totalPages, offset } = resolvePagination(sp, '/apps', total)

  const apps = await db.select().from(applications)
    .where(eq(applications.ownerUserId, session.user.id))
    .orderBy(desc(applications.createdAt), desc(applications.id))
    .limit(pageSize)
    .offset(offset)

  const appIds = apps.map((a) => a.id)
  const [creds, subs] = appIds.length ? await Promise.all([
    db.select({ appId: appCredentials.applicationId, n: count() }).from(appCredentials)
      .where(inArray(appCredentials.applicationId, appIds)).groupBy(appCredentials.applicationId),
    db.select({ appId: subscriptions.applicationId, n: count() }).from(subscriptions)
      .where(and(inArray(subscriptions.applicationId, appIds), eq(subscriptions.status, 'approved'))).groupBy(subscriptions.applicationId),
  ]) : [[], []]
  const credByApp = new Map(creds.map((r) => [r.appId, Number(r.n)]))
  const subByApp = new Map(subs.map((r) => [r.appId, Number(r.n)]))

  return (
    <main className="page">
      <Link href="/" className="text-sm font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">{t('catalog.backToCatalog')}</Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">{t('apps.title')}</h1>
      <div className="card mb-8">
        <h2 className="mb-4 font-bold">{t('apps.create')}</h2>
        <NewAppForm />
      </div>
      {apps.length === 0 ? (
        <p className="text-muted">{t('apps.empty')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((a) => (
            <Link key={a.id} href={`/apps/${a.id}`} className="card-hover group flex flex-col">
              <h3 className="font-bold group-hover:text-ink-soft">{a.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{a.description || '—'}</p>
              <p className="mt-2 font-mono text-xs text-muted">{a.kongConsumerUsername}</p>
              <div className="mt-3 flex gap-4 text-xs text-muted">
                <span>{credByApp.get(a.id) ?? 0} credentials</span>
                <span>{subByApp.get(a.id) ?? 0} subscriptions</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <Pagination
        basePath="/apps"
        searchParams={sp}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        total={total}
      />
    </main>
  )
}
