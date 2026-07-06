import Link from 'next/link'
import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { auditLogs, users } from '@/db/schema'

const PAGE = 50

// Warna per prefix aksi supaya mudah dipindai.
function actionColor(action: string): string {
  if (action.includes('delete') || action.includes('revoke') || action.includes('block') || action.includes('reject') || action.includes('suspend')) return 'text-red-700'
  if (action.includes('create') || action.includes('approve') || action.includes('import') || action.includes('publish')) return 'text-green-700'
  return 'text-gray-700'
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  const sp = await searchParams
  const filter = sp.action?.trim() ?? ''
  const page = Math.max(0, Number(sp.page ?? 0) || 0)

  const where = filter ? sql`${auditLogs.action} ILIKE ${'%' + filter + '%'}` : undefined
  const rows = await db.select({
    id: auditLogs.id,
    action: auditLogs.action,
    entityType: auditLogs.entityType,
    entityId: auditLogs.entityId,
    payload: auditLogs.payload,
    createdAt: auditLogs.createdAt,
    actorName: users.name,
    actorEmail: users.email,
  }).from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(where)
    .orderBy(desc(auditLogs.createdAt))
    .limit(PAGE + 1).offset(page * PAGE)

  const hasNext = rows.length > PAGE
  const items = rows.slice(0, PAGE)
  const qs = (p: number) => `?${new URLSearchParams({ ...(filter ? { action: filter } : {}), page: String(p) })}`

  return (
    <main>
      <h1 className="mb-4 text-xl font-bold">Audit Log</h1>
      <form className="mb-4 flex gap-2 text-sm">
        <input name="action" defaultValue={filter} placeholder="Filter aksi (mis. subscription, block, credential)"
          className="w-80 rounded border px-3 py-2" />
        <button className="rounded bg-blue-600 px-4 py-2 text-white">Filter</button>
        {filter && <Link href="/admin/audit" className="rounded border px-4 py-2">Reset</Link>}
      </form>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Waktu</th><th>Aktor</th><th>Aksi</th><th>Entity</th><th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <tr key={r.id} className="border-b align-top">
              <td className="py-2 whitespace-nowrap font-mono text-xs">{r.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
              <td className="whitespace-nowrap">{r.actorName ?? <span className="text-gray-400">sistem</span>}</td>
              <td className={`font-mono text-xs font-semibold ${actionColor(r.action)}`}>{r.action}</td>
              <td className="font-mono text-xs text-gray-500">{r.entityType}{r.entityId ? `:${r.entityId.slice(0, 8)}` : ''}</td>
              <td className="font-mono text-xs text-gray-500">{r.payload ? JSON.stringify(r.payload) : ''}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={5} className="py-4 text-gray-500">Tidak ada entri.</td></tr>}
        </tbody>
      </table>
      <div className="mt-4 flex gap-3 text-sm">
        {page > 0 && <Link href={qs(page - 1)} className="rounded border px-3 py-1.5">← Sebelumnya</Link>}
        {hasNext && <Link href={qs(page + 1)} className="rounded border px-3 py-1.5">Berikutnya →</Link>}
        <span className="py-1.5 text-gray-500">Halaman {page + 1}</span>
      </div>
    </main>
  )
}
