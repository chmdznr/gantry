import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { setProductStatus } from '@/actions/admin-products'
import PendingButton from '@/components/PendingButton'

const badge: Record<string, string> = {
  draft: 'badge-muted',
  published: 'badge-go',
  deprecated: 'badge-warn',
  retired: 'badge-stop',
}

export default async function AdminApisPage() {
  const rows = await db.select().from(apiProducts).orderBy(desc(apiProducts.updatedAt))
  return (
    <main>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">API Products</h1>
        <div className="flex gap-2">
          <Link href="/admin/apis/import" className="btn-outline btn-sm">Import dari Kong</Link>
          <Link href="/admin/apis/new" className="btn-primary btn-sm">+ API Baru</Link>
        </div>
      </div>
      <table className="table-base">
        <thead>
          <tr>
            <th>Nama</th><th>Slug</th><th>Kong services</th><th>Spec</th><th>Status</th><th>Aksi</th>
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
                    <PendingButton className="btn-outline btn-sm text-warn">Deprecate</PendingButton>
                  </form>
                )}
                {p.status === 'deprecated' && (
                  <form action={setProductStatus.bind(null, p.id, 'retired')} className="inline">
                    <PendingButton className="btn-danger btn-sm">Retire</PendingButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
