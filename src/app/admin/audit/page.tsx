import Link from 'next/link'
import { and, count, desc, eq, gte, lt, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { auditLogs, users } from '@/db/schema'

const PAGE = 50

function actionColor(action: string): string {
  if (/(delete|revoke|block|reject|suspend|retired)/.test(action)) return 'text-stop'
  if (/(create|approve|import|publish|unblock|activate)/.test(action)) return 'text-go'
  return 'text-ink-soft'
}

type Filters = { action?: string; entity?: string; actor?: string; from?: string; to?: string; q?: string; page?: string }

export default async function AuditPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const sp = await searchParams
  const page = Math.max(0, Number(sp.page ?? 0) || 0)

  const conds: SQL[] = []
  if (sp.action) conds.push(eq(auditLogs.action, sp.action))
  if (sp.entity) conds.push(eq(auditLogs.entityType, sp.entity))
  if (sp.actor) conds.push(eq(auditLogs.actorUserId, sp.actor))
  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) conds.push(gte(auditLogs.createdAt, new Date(sp.from)))
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) {
    const end = new Date(sp.to)
    end.setDate(end.getDate() + 1)
    conds.push(lt(auditLogs.createdAt, end))
  }
  if (sp.q?.trim()) {
    const like = `%${sp.q.trim()}%`
    conds.push(or(
      sql`${auditLogs.action} ILIKE ${like}`,
      sql`${auditLogs.entityId} ILIKE ${like}`,
      sql`${auditLogs.payload}::text ILIKE ${like}`,
    )!)
  }
  const where = conds.length ? and(...conds) : undefined

  const [rows, [{ total }], actions, entities, actors] = await Promise.all([
    db.select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      payload: auditLogs.payload,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
    }).from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(PAGE).offset(page * PAGE),
    db.select({ total: count() }).from(auditLogs).where(where),
    db.selectDistinct({ v: auditLogs.action }).from(auditLogs).orderBy(auditLogs.action),
    db.selectDistinct({ v: auditLogs.entityType }).from(auditLogs).orderBy(auditLogs.entityType),
    db.selectDistinct({ id: users.id, name: users.name })
      .from(auditLogs).innerJoin(users, eq(auditLogs.actorUserId, users.id)).orderBy(users.name),
  ])

  const pages = Math.max(1, Math.ceil(total / PAGE))
  const qs = (p: number) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) if (v && k !== 'page') params.set(k, v)
    if (p > 0) params.set('page', String(p))
    const str = params.toString()
    return str ? `?${str}` : '/admin/audit'
  }
  const activeFilters = ['action', 'entity', 'actor', 'from', 'to', 'q'].filter((k) => sp[k as keyof Filters]).length

  return (
    <main>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Audit Log</h1>
        <span className="text-sm text-muted">{total} entri{activeFilters > 0 ? ` · ${activeFilters} filter aktif` : ''}</span>
      </div>

      <form className="card mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-sm">
          <span className="label">Aksi</span>
          <select name="action" defaultValue={sp.action ?? ''} className="input">
            <option value="">Semua</option>
            {actions.map((a) => <option key={a.v} value={a.v}>{a.v}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Entity</span>
          <select name="entity" defaultValue={sp.entity ?? ''} className="input">
            <option value="">Semua</option>
            {entities.map((e) => <option key={e.v} value={e.v}>{e.v}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Aktor</span>
          <select name="actor" defaultValue={sp.actor ?? ''} className="input">
            <option value="">Semua</option>
            {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Dari</span>
          <input name="from" type="date" defaultValue={sp.from ?? ''} className="input" />
        </label>
        <label className="text-sm">
          <span className="label">Sampai</span>
          <input name="to" type="date" defaultValue={sp.to ?? ''} className="input" />
        </label>
        <label className="text-sm">
          <span className="label">Cari</span>
          <input name="q" defaultValue={sp.q ?? ''} placeholder="aksi / entity id / payload" className="input" />
        </label>
        <div className="col-span-full flex gap-2">
          <button className="btn-primary btn-sm">Terapkan</button>
          {activeFilters > 0 && <Link href="/admin/audit" className="btn-outline btn-sm">Reset</Link>}
        </div>
      </form>

      <table className="table-base">
        <thead>
          <tr>
            <th>Waktu</th><th>Aktor</th><th>Aksi</th><th>Entity</th><th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="whitespace-nowrap font-mono text-xs">{r.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</td>
              <td className="whitespace-nowrap">{r.actorName ?? <span className="text-muted">sistem</span>}</td>
              <td className={`font-mono text-xs font-semibold ${actionColor(r.action)}`}>{r.action}</td>
              <td className="font-mono text-xs text-muted">{r.entityType}{r.entityId ? `:${r.entityId.slice(0, 8)}` : ''}</td>
              <td className="max-w-md break-all font-mono text-xs text-muted">{r.payload ? JSON.stringify(r.payload) : ''}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="py-6 text-center text-muted">
              Tidak ada entri yang cocok dengan filter. <Link href="/admin/audit" className="underline">Reset filter</Link>
            </td></tr>
          )}
        </tbody>
      </table>

      <div className="mt-4 flex items-center gap-3 text-sm">
        {page > 0 && <Link href={qs(page - 1)} className="btn-outline btn-sm">← Sebelumnya</Link>}
        {page + 1 < pages && <Link href={qs(page + 1)} className="btn-outline btn-sm">Berikutnya →</Link>}
        <span className="text-muted">Halaman {page + 1} dari {pages}</span>
      </div>
    </main>
  )
}
