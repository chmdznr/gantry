import Link from 'next/link'
import { and, count, desc, eq, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import FilterBar, { countActive } from '@/components/FilterBar'
import { setProductStatus } from '@/actions/admin-products'
import PendingButton from '@/components/PendingButton'
import Pagination from '@/components/Pagination'
import { resolvePagination } from '@/lib/pagination'

const badge: Record<string, string> = {
  draft: 'badge-muted',
  published: 'badge-go',
  deprecated: 'badge-warn',
  retired: 'badge-stop',
}

type Filters = { q?: string; status?: string }

export default async function AdminApisPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const sp = await searchParams
  const conds: SQL[] = []
  if (sp.q?.trim()) {
    const like = `%${sp.q.trim()}%`
    conds.push(or(
      sql`${apiProducts.name} ILIKE ${like}`,
      sql`${apiProducts.slug} ILIKE ${like}`,
      sql`${apiProducts.description} ILIKE ${like}`,
    )!)
  }
  if (sp.status && ['draft', 'published', 'deprecated', 'retired'].includes(sp.status)) {
    conds.push(eq(apiProducts.status, sp.status as 'draft'))
  }
  const where = conds.length ? and(...conds) : undefined
  const [{ total }] = await db.select({ total: count() }).from(apiProducts).where(where)
  const { page, pageSize, totalPages, offset } = resolvePagination(sp, '/admin/apis', total)
  const rows = await db.select().from(apiProducts)
    .where(where)
    .orderBy(desc(apiProducts.updatedAt), apiProducts.id)
    .limit(pageSize).offset(offset)
  const active = countActive(sp, ['q', 'status'])
  return (
    <main>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">API Products <span className="ml-1 align-middle text-sm font-normal text-muted">{total}{active > 0 ? ` · ${active} active filters` : ''}</span></h1>
        <div className="flex gap-2">
          <Link href="/admin/apis/import" className="btn-outline btn-sm">Import from Kong</Link>
          <Link href="/admin/apis/new" className="btn-primary btn-sm">+ New API</Link>
        </div>
      </div>
      <FilterBar resetHref="/admin/apis" activeCount={active}>
        <label className="text-sm">
          <span className="label">Search</span>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="name / slug / description" className="input w-64" />
        </label>
        <label className="text-sm">
          <span className="label">Status</span>
          <select name="status" defaultValue={sp.status ?? ''} className="input w-auto">
            <option value="">All</option>
            {['draft', 'published', 'deprecated', 'retired'].map((st) => <option key={st} value={st}>{st}</option>)}
          </select>
        </label>
      </FilterBar>

      <table className="table-base">
        <thead>
          <tr>
            <th>Name</th><th>Slug</th><th>Kong services</th><th>Spec</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td><Link href={`/admin/apis/${p.id}`} className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">{p.name}</Link></td>
              <td className="font-mono text-xs">{p.slug}</td>
              <td className="font-mono text-xs">{p.kongServiceNames.join(', ')}</td>
              <td>{p.openapiSpec ? '✓' : '—'}</td>
              <td><span className={`${badge[p.status]}`}>{p.status}</span></td>
              <td className="space-x-2">
                {p.status !== 'published' && (
                  <form action={setProductStatus.bind(null, p.id, 'published')} className="inline">
                    <PendingButton className="btn-primary btn-sm">Publish</PendingButton>
                  </form>
                )}
                {p.status === 'published' && (
                  <form action={setProductStatus.bind(null, p.id, 'deprecated')} className="inline">
                    <PendingButton confirm={`Deprecate "${p.name}"? It stays in the catalog with a deprecated badge.`} className="btn-outline btn-sm text-warn">Deprecate</PendingButton>
                  </form>
                )}
                {p.status === 'deprecated' && (
                  <form action={setProductStatus.bind(null, p.id, 'retired')} className="inline">
                    <PendingButton confirm={`Retire "${p.name}"? It will disappear from the catalog.`} className="btn-danger btn-sm">Retire</PendingButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination
        basePath="/admin/apis"
        searchParams={sp}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        total={total}
      />
    </main>
  )
}
