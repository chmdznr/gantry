import { and, desc, eq, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { db } from '@/db'
import { appCredentials, applications, subscriptions, users } from '@/db/schema'
import FilterBar, { countActive } from '@/components/FilterBar'
import { adminDeleteApp, adminRevokeCredential, blockApp, unblockApp } from '@/actions/admin-consumers'
import PendingButton from '@/components/PendingButton'
import { allConsumersUsage } from '@/lib/metrics'
import { RANGES } from '@/lib/ranges'
import { RangeSelector } from '@/components/RangeSelector'
import { BandwidthTable, RequestTable } from '@/components/AppStats'

type Filters = { q?: string; blocked?: string; range?: string }

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
    .orderBy(desc(applications.createdAt))

  const [creds, subs, usage, t] = await Promise.all([
    db.select().from(appCredentials),
    db.select({ applicationId: subscriptions.applicationId, status: subscriptions.status }).from(subscriptions),
    allConsumersUsage(range),
    getTranslations('apps'),
  ])
  const requestsByConsumer = new Map<string, number>()
  for (const r of usage?.requests ?? []) {
    requestsByConsumer.set(r.consumer, (requestsByConsumer.get(r.consumer) ?? 0) + r.count)
  }
  const maxRequests = Math.max(1, ...requestsByConsumer.values())

  return (
    <main>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Consumers (Applications)</h1>
        <span className="text-sm text-muted">{apps.length} applications{active > 0 ? ` · ${active} active filters` : ''}</span>
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
      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <span>Requests over:</span>
        <RangeSelector current={range} />
        {usage === null && <span>· usage stats unavailable (Prometheus not configured or unreachable)</span>}
      </div>
      {apps.length === 0 && <p className="text-sm text-muted">No applications match the filters.</p>}
      <div className="space-y-4">
        {apps.map((a) => {
          const appCreds = creds.filter((c) => c.applicationId === a.id)
          const appSubs = subs.filter((s) => s.applicationId === a.id)
          return (
            <div key={a.id} className={`rounded border p-4 ${a.blockedAt ? 'border-stop/40 bg-stop-soft/50' : ''}`}>
              <div className="flex flex-wrap items-center gap-3">
                <b>{a.name}</b>
                <span className="font-mono text-xs text-muted">{a.consumerUsername}</span>
                <span className="text-sm text-muted">{a.ownerName} ({a.ownerEmail})</span>
                <span className="text-xs text-muted">
                  {appSubs.filter((s) => s.status === 'approved').length} active subscriptions · {appCreds.length} credentials
                </span>
                {a.blockedAt && <span className="badge-stop">BLOCKED</span>}
                <span className="ml-auto flex gap-2">
                  {a.blockedAt ? (
                    <form action={unblockApp.bind(null, a.id)}>
                      <PendingButton className="btn-outline btn-sm">Unblock</PendingButton>
                    </form>
                  ) : (
                    <form action={blockApp.bind(null, a.id)}>
                      <PendingButton confirm={`Block "${a.name}"? All its API calls will be rejected.`} className="btn-danger btn-sm">Block</PendingButton>
                    </form>
                  )}
                  <form action={adminDeleteApp.bind(null, a.id)}>
                    <PendingButton confirm={`Delete application "${a.name}" and its Kong consumer? This cannot be undone.`} className="btn-danger btn-sm">Delete</PendingButton>
                  </form>
                </span>
              </div>
              {a.consumerUsername && usage !== null && (() => {
                const total = requestsByConsumer.get(a.consumerUsername) ?? 0
                const reqRows = usage.requests.filter((r) => r.consumer === a.consumerUsername)
                const bwRows = usage.bandwidth.filter((r) => r.consumer === a.consumerUsername)
                const statLine = (
                  <span className="inline-flex items-center gap-2 align-middle">
                    <span className="inline-block h-2 w-48 overflow-hidden rounded-full bg-ink/10">
                      <span className="block h-full rounded-full bg-amber" style={{ width: `${(total / maxRequests) * 100}%` }} />
                    </span>
                    <span className="text-xs text-muted">{total.toLocaleString()} requests ({range})</span>
                  </span>
                )
                if (reqRows.length === 0 && bwRows.length === 0) {
                  return <div className="mt-2">{statLine}</div>
                }
                return (
                  <details className="mt-2 group">
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                      {statLine}
                      <span className="ml-2 align-middle text-xs text-ink-soft underline decoration-amber decoration-2 underline-offset-2">
                        <span className="group-open:hidden">breakdown ▾</span>
                        <span className="hidden group-open:inline">hide ▴</span>
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
              })()}
              {appCreds.length > 0 && (
                <table className="table-base mt-3">
                  <thead><tr className="border-b text-left text-xs text-muted"><th>Credential</th><th>Hint</th><th>Created</th><th></th></tr></thead>
                  <tbody>
                    {appCreds.map((c) => (
                      <tr key={c.id}>
                        <td>{c.type === 'key-auth' ? 'API Key' : 'JWT'}</td>
                        <td className="font-mono">…{c.hint}</td>
                        <td>{c.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                        <td className="text-right">
                          <form action={adminRevokeCredential.bind(null, a.id, c.id)}>
                            <PendingButton confirm="Revoke this credential? Apps using it will stop working immediately." className="btn-danger btn-sm">Revoke</PendingButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
