import { Suspense } from 'react'
import { and, count, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { appCredentials, applications, subscriptions, users } from '@/db/schema'
import FilterBar, { countActive } from '@/components/FilterBar'
import { adminDeleteApp, adminRevokeCredential, blockApp, unblockApp } from '@/actions/admin-consumers'
import PendingButton from '@/components/PendingButton'
import CopyButton from '@/components/CopyButton'
import { allConsumersUsage, type AllConsumersUsage } from '@/lib/metrics'
import { RANGES } from '@/lib/ranges'
import { RangeSelector } from '@/components/RangeSelector'
import { BandwidthTable, RequestTable } from '@/components/AppStats'
import Pagination from '@/components/Pagination'
import { resolvePagination } from '@/lib/pagination'

type Filters = { q?: string; blocked?: string; range?: string; page?: string; rows?: string }

function fmtDateTime(d: Date): string {
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

// Statistik Prometheus dimuat terpisah dari daftar aplikasi: Prometheus yang lambat
// tidak boleh menahan filter, daftar app, dan form block/revoke/delete.
async function AppUsage({ consumerUsername, range, usagePromise }: {
  consumerUsername: string
  range: string
  usagePromise: Promise<AllConsumersUsage | null>
}) {
  const usage = await usagePromise
  if (usage === null) return null // pesan "unavailable" tampil sekali di header usage
  const t = await getTranslations('apps')

  const requestsByConsumer = new Map<string, number>()
  for (const r of usage.requests) {
    requestsByConsumer.set(r.consumer, (requestsByConsumer.get(r.consumer) ?? 0) + r.count)
  }
  const maxRequests = Math.max(1, ...requestsByConsumer.values())
  const total = requestsByConsumer.get(consumerUsername) ?? 0
  const reqRows = usage.requests.filter((r) => r.consumer === consumerUsername)
  const bwRows = usage.bandwidth.filter((r) => r.consumer === consumerUsername)
  const statLine = total === 0 ? (
    <span className="text-xs text-muted tabular-nums">{t('usageNoRequests', { range })}</span>
  ) : (
    <span className="inline-flex flex-wrap items-center gap-2 align-middle">
      <span aria-hidden="true" className="inline-block h-2 w-40 overflow-hidden rounded-full bg-ink/10">
        <span className="block h-full rounded-full bg-amber" style={{ width: `${Math.max(2, (total / maxRequests) * 100)}%` }} />
      </span>
      <span className="text-xs text-muted tabular-nums">{t('usageRequests', { total: total.toLocaleString(), range })}</span>
    </span>
  )
  if (reqRows.length === 0 && bwRows.length === 0) {
    return <div className="mt-3">{statLine}</div>
  }
  return (
    <details className="group mt-3">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
        {statLine}
        <span className="text-xs text-ink-soft underline decoration-amber decoration-2 underline-offset-2">
          <span className="group-open:hidden">{t('breakdownShow')}</span>
          <span className="hidden group-open:inline">{t('breakdownHide')}</span>
        </span>
      </summary>
      <div className="mt-3 max-w-3xl space-y-4">
        {reqRows.length > 0 && <RequestTable stats={reqRows} t={t} />}
        {bwRows.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Bandwidth</p>
            <BandwidthTable bw={bwRows} t={t} />
          </div>
        )}
      </div>
    </details>
  )
}

async function UsageNotice({ usagePromise }: { usagePromise: Promise<AllConsumersUsage | null> }) {
  const usage = await usagePromise
  if (usage !== null) return null
  const t = await getTranslations('apps')
  return <span>· {t('usageUnavailable')}</span>
}

export default async function AdminConsumersPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const sp = await searchParams
  const range = (RANGES as readonly string[]).includes(sp.range ?? '') ? sp.range! : '24h'
  const conds: SQL[] = []
  if (sp.q?.trim()) {
    const like = `%${sp.q.trim()}%`
    conds.push(or(
      sql`${applications.name} ILIKE ${like}`,
      sql`${applications.kongConsumerUsername} ILIKE ${like}`,
      sql`${users.name} ILIKE ${like}`,
      sql`${users.email} ILIKE ${like}`,
    )!)
  }
  if (sp.blocked === 'yes') conds.push(isNotNull(applications.blockedAt))
  if (sp.blocked === 'no') conds.push(isNull(applications.blockedAt))
  const active = countActive(sp, ['q', 'blocked'])
  // Mulai query Prometheus lebih awal, tapi jangan di-await di sini.
  const usagePromise = allConsumersUsage(range)

  // Hitung dengan filter yang sama sebelum mengambil baris halaman aktif.
  const totalRows = await db.select({ n: count() }).from(applications)
    .innerJoin(users, eq(applications.ownerUserId, users.id))
    .where(conds.length ? and(...conds) : undefined)
  const total = Number(totalRows[0]?.n ?? 0)
  const { page, pageSize, totalPages, offset } = resolvePagination(sp, '/admin/consumers', total)

  const apps = await db.select({
    id: applications.id,
    name: applications.name,
    consumerUsername: applications.kongConsumerUsername,
    blockedAt: applications.blockedAt,
    createdAt: applications.createdAt,
    ownerName: users.name,
    ownerEmail: users.email,
  }).from(applications)
    .innerJoin(users, eq(applications.ownerUserId, users.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(applications.createdAt), desc(applications.id))
    .limit(pageSize)
    .offset(offset)

  const appIds = apps.map((a) => a.id)
  const [creds, subs, t] = await Promise.all([
    appIds.length
      ? db.select().from(appCredentials).where(inArray(appCredentials.applicationId, appIds))
      : [],
    appIds.length
      ? db.select({ applicationId: subscriptions.applicationId, status: subscriptions.status }).from(subscriptions)
        .where(inArray(subscriptions.applicationId, appIds))
      : [],
    getTranslations('apps'),
  ])

  return (
    <main>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Consumers (Applications)</h1>
        <span className="text-sm text-muted">{total} applications{active > 0 ? ` · ${active} active filters` : ''}</span>
      </div>
      <FilterBar resetHref="/admin/consumers" activeCount={active}>
        <label className="text-sm">
          <span className="label">Search</span>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="app / consumer / owner" className="input w-64" />
        </label>
        <label className="text-sm">
          <span className="label">Blocked</span>
          <select name="blocked" defaultValue={sp.blocked ?? ''} className="input w-auto">
            <option value="">All</option>
            <option value="yes">Blocked</option>
            <option value="no">Not blocked</option>
          </select>
        </label>
        <input type="hidden" name="range" value={range} />
      </FilterBar>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>Requests over:</span>
        <RangeSelector current={range} />
        <Suspense fallback={null}>
          <UsageNotice usagePromise={usagePromise} />
        </Suspense>
      </div>
      {apps.length === 0 && <p className="text-sm text-muted">No applications match the filters.</p>}
      <div className="space-y-4">
        {apps.map((a) => {
          const appCreds = creds.filter((c) => c.applicationId === a.id)
          const appSubs = subs.filter((s) => s.applicationId === a.id)
          const activeSubs = appSubs.filter((s) => s.status === 'approved').length
          return (
            <div key={a.id} className={`rounded-2xl border p-4 ${a.blockedAt ? 'border-stop/40 bg-stop-soft/50' : 'border-line bg-surface'}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold break-words">{a.name}</h2>
                    <span className={a.blockedAt ? 'badge-stop' : 'badge-go'}>
                      {a.blockedAt ? t('statusBlocked') : t('statusActive')}
                    </span>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    <code className="min-w-0 truncate font-mono text-xs text-muted" title={a.consumerUsername}>
                      {a.consumerUsername}
                    </code>
                    <CopyButton value={a.consumerUsername} />
                  </div>
                  <p className="mt-1 text-sm text-muted break-words">
                    {t('ownerLabel')}: {a.ownerName} · {a.ownerEmail}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted tabular-nums">
                    <span>{t('createdAt')}: {fmtDateTime(a.createdAt)}</span>
                    <span>{t('activeSubscriptions', { count: activeSubs })}</span>
                    <span>{t('credentialsCount', { count: appCreds.length })}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
                  {a.blockedAt ? (
                    <form action={unblockApp.bind(null, a.id)}>
                      <PendingButton className="btn-outline btn-sm">Unblock</PendingButton>
                    </form>
                  ) : (
                    <form action={blockApp.bind(null, a.id)}>
                      <PendingButton confirm={`Block "${a.name}"? All its API calls will be rejected.`} className="btn-outline btn-sm">Block</PendingButton>
                    </form>
                  )}
                  <form action={adminDeleteApp.bind(null, a.id)}>
                    <PendingButton confirm={`Delete application "${a.name}" and its Kong consumer? This cannot be undone.`} className="btn-danger btn-sm">Delete</PendingButton>
                  </form>
                </div>
              </div>
              {a.consumerUsername && (
                <Suspense fallback={<div className="mt-3 text-xs text-muted">{t('usageLoading')}</div>}>
                  <AppUsage consumerUsername={a.consumerUsername} range={range} usagePromise={usagePromise} />
                </Suspense>
              )}
              {appCreds.length > 0 ? (
                <details className="group mt-4">
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                    <span>{t('credentialsTitle')} ({appCreds.length})</span>
                    <span className="text-xs font-normal text-muted group-open:hidden">{t('show')}</span>
                    <span className="hidden text-xs font-normal text-muted group-open:inline">{t('hide')}</span>
                  </summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="table-base">
                      <thead>
                        <tr>
                          <th>{t('credType')}</th><th>{t('hint')}</th><th>{t('createdAt')}</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {appCreds.map((c) => (
                          <tr key={c.id}>
                            <td>{c.type === 'key-auth' ? t('apiKey') : 'JWT'}</td>
                            <td className="font-mono">…{c.hint}</td>
                            <td className="whitespace-nowrap tabular-nums">{fmtDateTime(c.createdAt)}</td>
                            <td className="text-right">
                              <form action={adminRevokeCredential.bind(null, a.id, c.id)}>
                                <PendingButton confirm="Revoke this credential? Apps using it will stop working immediately." className="btn-outline btn-sm text-stop">Revoke</PendingButton>
                              </form>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : (
                <p className="mt-4 text-xs text-muted">{t('noCredentials')}</p>
              )}
            </div>
          )
        })}
      </div>
      <Pagination
        basePath="/admin/consumers"
        searchParams={sp}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        total={total}
      />
    </main>
  )
}
