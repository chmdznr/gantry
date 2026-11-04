import { count, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { plans, subscriptions } from '@/db/schema'
import FilterBar, { countActive } from '@/components/FilterBar'
import { deletePlan } from '@/actions/admin-plans'
import PlanForm from '@/components/PlanForm'
import PendingButton from '@/components/PendingButton'
import Pagination from '@/components/Pagination'
import { resolvePagination } from '@/lib/pagination'

export default async function AdminPlansPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams
  const like = sp.q?.trim() ? `%${sp.q.trim()}%` : null
  const where = like ? or(sql`${plans.name} ILIKE ${like}`, sql`${plans.description} ILIKE ${like}`) : undefined
  const [{ total }] = await db.select({ total: count() }).from(plans).where(where)
  const { page, pageSize, totalPages, offset } = resolvePagination(sp, '/admin/plans', total)
  const [rows, usedRows] = await Promise.all([
    db.select().from(plans)
      .where(where)
      .orderBy(plans.name, plans.id)
      .limit(pageSize).offset(offset),
    // plan yang masih dipakai subscription tidak bisa dihapus — disable tombolnya
    db.selectDistinct({ planId: subscriptions.planId }).from(subscriptions),
  ])
  const active = countActive(sp, ['q'])
  const used = new Set(usedRows.map((u) => u.planId))
  return (
    <main>
      <h1 className="mb-4 text-xl font-bold">Plans (Rate-Limit Tiers)</h1>
      <div className="mb-6"><PlanForm /></div>
      <FilterBar resetHref="/admin/plans" activeCount={active}>
        <label className="text-sm">
          <span className="label">Search</span>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="name / description" className="input w-64" />
        </label>
      </FilterBar>
      <table className="table-base max-w-2xl">
        <thead><tr><th>Name</th><th>Limit</th><th>Description</th><th></th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{p.name}</td>
              <td>{Object.entries(p.rateLimit as Record<string, number>).map(([k, v]) => `${v}/${k}`).join(', ')}</td>
              <td className="text-muted">{p.description}</td>
              <td className="text-right">
                {used.has(p.id) ? (
                  <button disabled title="In use by subscriptions — cannot be deleted" className="btn-danger btn-sm opacity-50">
                    Delete
                  </button>
                ) : (
                  <form action={deletePlan.bind(null, p.id)}>
                    <PendingButton confirm={`Delete plan "${p.name}"?`} className="btn-danger btn-sm">Delete</PendingButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        basePath="/admin/plans"
        searchParams={sp}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        total={total}
      />
    </main>
  )
}
