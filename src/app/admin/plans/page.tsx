import { or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { plans } from '@/db/schema'
import FilterBar, { countActive } from '@/components/FilterBar'
import { deletePlan } from '@/actions/admin-plans'
import PlanForm from '@/components/PlanForm'
import PendingButton from '@/components/PendingButton'

export default async function AdminPlansPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams
  const like = sp.q?.trim() ? `%${sp.q.trim()}%` : null
  const rows = await db.select().from(plans)
    .where(like ? or(sql`${plans.name} ILIKE ${like}`, sql`${plans.description} ILIKE ${like}`) : undefined)
    .orderBy(plans.name)
  const active = countActive(sp, ['q'])
  return (
    <main>
      <h1 className="mb-4 text-xl font-bold">Plans (Rate-Limit Tiers)</h1>
      <div className="mb-6"><PlanForm /></div>
      <FilterBar resetHref="/admin/plans" activeCount={active}>
        <label className="text-sm">
          <span className="label">Cari</span>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="nama / deskripsi" className="input w-64" />
        </label>
      </FilterBar>
      <table className="table-base max-w-2xl">
        <thead><tr><th>Nama</th><th>Limit</th><th>Deskripsi</th><th></th></tr></thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{p.name}</td>
              <td>{Object.entries(p.rateLimit as Record<string, number>).map(([k, v]) => `${v}/${k}`).join(', ')}</td>
              <td className="text-muted">{p.description}</td>
              <td className="text-right">
                <form action={deletePlan.bind(null, p.id)}>
                  <PendingButton className="btn-danger btn-sm">Hapus</PendingButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
