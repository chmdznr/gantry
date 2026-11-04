import { count, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { adminApiTokens, users } from '@/db/schema'
import { revokeAdminToken } from '@/actions/admin-tokens'
import AdminTokenForm from '@/components/AdminTokenForm'
import PendingButton from '@/components/PendingButton'
import Pagination from '@/components/Pagination'
import { resolvePagination, type PageSearchParams } from '@/lib/pagination'
import { ADMIN_API_SCOPES, ADMIN_API_SCOPE_LABELS } from '@/lib/admin-api-tokens'

function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—'
}

function statusOf(t: { revokedAt: Date | null; expiresAt: Date }): { label: string; className: string } {
  if (t.revokedAt) return { label: 'revoked', className: 'badge-stop' }
  if (t.expiresAt.getTime() <= Date.now()) return { label: 'expired', className: 'badge-warn' }
  return { label: 'active', className: 'badge-go' }
}

export default async function AdminTokensPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const sp = await searchParams
  const [{ total }] = await db
    .select({ total: count() })
    .from(adminApiTokens)
    .innerJoin(users, eq(adminApiTokens.userId, users.id))
  const { page, pageSize, totalPages, offset } = resolvePagination(sp, '/admin/tokens', total)
  const rows = await db
    .select({
      id: adminApiTokens.id,
      name: adminApiTokens.name,
      tokenPrefix: adminApiTokens.tokenPrefix,
      scopes: adminApiTokens.scopes,
      expiresAt: adminApiTokens.expiresAt,
      lastUsedAt: adminApiTokens.lastUsedAt,
      revokedAt: adminApiTokens.revokedAt,
      createdAt: adminApiTokens.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(adminApiTokens)
    .innerJoin(users, eq(adminApiTokens.userId, users.id))
    .orderBy(desc(adminApiTokens.createdAt), adminApiTokens.id)
    .limit(pageSize).offset(offset)

  const scopes = ADMIN_API_SCOPES.map((value) => ({ value, label: ADMIN_API_SCOPE_LABELS[value] }))

  return (
    <main>
      <h1 className="mb-1 text-xl font-bold">API Tokens</h1>
      <p className="mb-4 max-w-2xl text-sm text-muted">
        Bearer tokens for the headless Admin API (<span className="font-mono text-xs">/api/admin/v1</span>).
        The plain token is shown once at creation; only a hash and prefix are stored. Tokens act as their
        owning portal admin, so revoke them when the owner changes role or leaves.
      </p>

      <AdminTokenForm scopes={scopes} />

      <table className="table-base">
        <thead>
          <tr>
            <th>Name</th><th>Prefix</th><th>Owner</th><th>Scopes</th><th>Status</th>
            <th>Expires</th><th>Last used</th><th>Created</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const status = statusOf(t)
            return (
              <tr key={t.id}>
                <td className="font-medium">{t.name}</td>
                <td className="font-mono text-xs">{t.tokenPrefix}…</td>
                <td>
                  <div>{t.userName}</div>
                  <div className="text-xs text-muted">{t.userEmail}</div>
                </td>
                <td className="font-mono text-xs">{t.scopes.join(', ')}</td>
                <td><span className={status.className}>{status.label}</span></td>
                <td className="whitespace-nowrap text-xs">{formatDate(t.expiresAt)}</td>
                <td className="whitespace-nowrap text-xs">{formatDate(t.lastUsedAt)}</td>
                <td className="whitespace-nowrap text-xs">{formatDate(t.createdAt)}</td>
                <td className="text-right">
                  {!t.revokedAt && (
                    <form action={revokeAdminToken.bind(null, t.id)}>
                      <PendingButton
                        confirm={`Revoke token "${t.name}"? Agents using it will get 401 immediately.`}
                        className="btn-danger btn-sm"
                      >
                        Revoke
                      </PendingButton>
                    </form>
                  )}
                </td>
              </tr>
            )
          })}
          {rows.length === 0 && (
            <tr><td colSpan={9} className="text-sm text-muted">No API tokens yet.</td></tr>
          )}
        </tbody>
      </table>
      <Pagination
        basePath="/admin/tokens"
        searchParams={sp}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        total={total}
      />
    </main>
  )
}
