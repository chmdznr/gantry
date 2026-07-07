import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiProductSpecVersions } from '@/db/schema'
import type { EndpointDiff } from '@/lib/openapi-diff'

function DiffList({ label, items, color }: { label: string; items: string[]; color: string }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
      <span className={`text-xs font-semibold ${color}`}>{label}</span>
      {items.map((e) => <code key={e} className="font-mono text-xs text-muted">{e}</code>)}
    </div>
  )
}

export default async function SpecHistory({ productId }: { productId: string }) {
  const versions = await db.select().from(apiProductSpecVersions)
    .where(eq(apiProductSpecVersions.apiProductId, productId))
    .orderBy(desc(apiProductSpecVersions.createdAt))
    .limit(20)
  if (versions.length === 0) return null

  return (
    <div className="space-y-3">
      {versions.map((v, i) => {
        const d = (v.changelog as EndpointDiff | null) ?? { added: [], removed: [], changed: [] }
        const isCurrent = i === 0
        return (
          <div key={v.id} className="card p-3">
            <div className="flex items-center gap-2 text-sm">
              <b>v{v.version}</b>
              {isCurrent && <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">terkini</span>}
              {d.removed.length > 0 && <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-stop">breaking</span>}
              <span className="ml-auto text-xs text-muted">{v.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</span>
            </div>
            {v.note && <p className="mt-1 text-sm text-ink-soft">{v.note}</p>}
            <div className="mt-2 space-y-1">
              <DiffList label="＋ ditambah" items={d.added} color="text-go" />
              <DiffList label="－ dihapus" items={d.removed} color="text-stop" />
              <DiffList label="~ diubah" items={d.changed} color="text-warn" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
