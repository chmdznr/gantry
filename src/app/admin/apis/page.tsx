import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { setProductStatus } from '@/actions/admin-products'

const badge: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-800',
  deprecated: 'bg-red-100 text-red-800',
}

export default async function AdminApisPage() {
  const rows = await db.select().from(apiProducts).orderBy(desc(apiProducts.updatedAt))
  return (
    <main>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">API Products</h1>
        <Link href="/admin/apis/new" className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white">+ API Baru</Link>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Nama</th><th>Slug</th><th>Kong services</th><th>Spec</th><th>Status</th><th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b">
              <td className="py-2"><Link href={`/admin/apis/${p.id}`} className="text-blue-600 underline">{p.name}</Link></td>
              <td className="font-mono text-xs">{p.slug}</td>
              <td className="font-mono text-xs">{p.kongServiceNames.join(', ')}</td>
              <td>{p.openapiSpec ? '✓' : '—'}</td>
              <td><span className={`rounded px-2 py-0.5 text-xs ${badge[p.status]}`}>{p.status}</span></td>
              <td className="space-x-2 py-1">
                {p.status !== 'published' && (
                  <form action={setProductStatus.bind(null, p.id, 'published')} className="inline">
                    <button className="rounded bg-green-600 px-2 py-1 text-xs text-white">Publish</button>
                  </form>
                )}
                {p.status === 'published' && (
                  <form action={setProductStatus.bind(null, p.id, 'deprecated')} className="inline">
                    <button className="rounded bg-red-600 px-2 py-1 text-xs text-white">Deprecate</button>
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
