import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { apiProducts, applications, plans, subscriptions, users } from '@/db/schema'
import { approveSubscription, rejectSubscription, revokeSubscription } from '@/actions/subscriptions'
import PendingButton from '@/components/PendingButton'
import FilterBar, { countActive } from '@/components/FilterBar'

const badge: Record<string, string> = {
  requested: 'badge-warn',
  approved: 'badge-go',
  rejected: 'badge-stop',
  revoked: 'badge-muted',
}

type Filters = { q?: string; status?: string; product?: string; plan?: string }

export default async function AdminSubscriptionsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const sp = await searchParams
  const conds: SQL[] = []
  if (sp.status && ['requested', 'approved', 'rejected', 'revoked'].includes(sp.status)) {
    conds.push(eq(subscriptions.status, sp.status as 'requested'))
  }
  if (sp.product) conds.push(eq(subscriptions.apiProductId, sp.product))
  if (sp.plan) conds.push(eq(subscriptions.planId, sp.plan))
  if (sp.q?.trim()) {
    const like = `%${sp.q.trim()}%`
    conds.push(or(
      sql`${applications.name} ILIKE ${like}`,
      sql`${users.email} ILIKE ${like}`,
      sql`${users.name} ILIKE ${like}`,
    )!)
  }

  const [rows, productOpts, planOpts] = await Promise.all([
    db.select({
      id: subscriptions.id,
      status: subscriptions.status,
      requestedAt: subscriptions.requestedAt,
      appName: applications.name,
      ownerEmail: users.email,
      productName: apiProducts.name,
      planName: plans.name,
    }).from(subscriptions)
      .innerJoin(applications, eq(subscriptions.applicationId, applications.id))
      .innerJoin(users, eq(applications.ownerUserId, users.id))
      .innerJoin(apiProducts, eq(subscriptions.apiProductId, apiProducts.id))
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(subscriptions.requestedAt)),
    db.select({ id: apiProducts.id, name: apiProducts.name }).from(apiProducts).orderBy(apiProducts.name),
    db.select({ id: plans.id, name: plans.name }).from(plans).orderBy(plans.name),
  ])
  const active = countActive(sp, ['q', 'status', 'product', 'plan'])

  return (
    <main>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Subscriptions</h1>
        <span className="text-sm text-muted">{rows.length} subscription{active > 0 ? ` · ${active} filter aktif` : ''}</span>
      </div>

      <FilterBar resetHref="/admin/subscriptions" activeCount={active}>
        <label className="text-sm">
          <span className="label">Cari</span>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="application / pemilik" className="input w-56" />
        </label>
        <label className="text-sm">
          <span className="label">Status</span>
          <select name="status" defaultValue={sp.status ?? ''} className="input w-auto">
            <option value="">Semua</option>
            {['requested', 'approved', 'rejected', 'revoked'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">API</span>
          <select name="product" defaultValue={sp.product ?? ''} className="input w-auto">
            <option value="">Semua</option>
            {productOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Plan</span>
          <select name="plan" defaultValue={sp.plan ?? ''} className="input w-auto">
            <option value="">Semua</option>
            {planOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </FilterBar>

      <table className="table-base">
        <thead>
          <tr>
            <th>Application</th><th>Pemilik</th><th>API</th><th>Plan</th><th>Diajukan</th><th>Status</th><th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>{s.appName}</td>
              <td>{s.ownerEmail}</td>
              <td>{s.productName}</td>
              <td>{s.planName}</td>
              <td>{s.requestedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
              <td><span className={badge[s.status]}>{s.status}</span></td>
              <td className="space-x-2">
                {s.status === 'requested' && (
                  <>
                    <form action={approveSubscription.bind(null, s.id)} className="inline">
                      <PendingButton className="btn-primary btn-sm">Approve</PendingButton>
                    </form>
                    <form action={rejectSubscription.bind(null, s.id)} className="inline">
                      <PendingButton className="btn-danger btn-sm">Reject</PendingButton>
                    </form>
                  </>
                )}
                {s.status === 'approved' && (
                  <form action={revokeSubscription.bind(null, s.id)} className="inline">
                    <PendingButton className="btn-outline btn-sm">Revoke</PendingButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={7} className="py-6 text-center text-muted">Tidak ada subscription yang cocok dengan filter.</td></tr>}
        </tbody>
      </table>
    </main>
  )
}
