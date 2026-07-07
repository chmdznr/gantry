import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { appCredentials, applications, subscriptions, users } from '@/db/schema'
import { adminDeleteApp, adminRevokeCredential, blockApp, unblockApp } from '@/actions/admin-consumers'
import PendingButton from '@/components/PendingButton'

export default async function AdminConsumersPage() {
  const apps = await db.select({
    id: applications.id,
    name: applications.name,
    consumerUsername: applications.kongConsumerUsername,
    blockedAt: applications.blockedAt,
    createdAt: applications.createdAt,
    ownerName: users.name,
    ownerEmail: users.email,
  }).from(applications)
    .innerJoin(users, eq(applications.ownerUserId, users.id))
    .orderBy(desc(applications.createdAt))

  const [creds, subs] = await Promise.all([
    db.select().from(appCredentials),
    db.select({ applicationId: subscriptions.applicationId, status: subscriptions.status }).from(subscriptions),
  ])

  return (
    <main>
      <h1 className="mb-4 text-xl font-bold">Consumers (Applications)</h1>
      {apps.length === 0 && <p className="text-sm text-muted">Belum ada application.</p>}
      <div className="space-y-4">
        {apps.map((a) => {
          const appCreds = creds.filter((c) => c.applicationId === a.id)
          const appSubs = subs.filter((s) => s.applicationId === a.id)
          return (
            <div key={a.id} className={`rounded border p-4 ${a.blockedAt ? 'border-stop/40 bg-stop-soft/50' : ''}`}>
              <div className="flex flex-wrap items-center gap-3">
                <b>{a.name}</b>
                <span className="font-mono text-xs text-muted">{a.consumerUsername}</span>
                <span className="text-sm text-muted">{a.ownerName} ({a.ownerEmail})</span>
                <span className="text-xs text-muted">
                  {appSubs.filter((s) => s.status === 'approved').length} subscription aktif · {appCreds.length} credential
                </span>
                {a.blockedAt && <span className="badge-stop">DIBLOKIR</span>}
                <span className="ml-auto flex gap-2">
                  {a.blockedAt ? (
                    <form action={unblockApp.bind(null, a.id)}>
                      <PendingButton className="btn-outline btn-sm">Buka Blokir</PendingButton>
                    </form>
                  ) : (
                    <form action={blockApp.bind(null, a.id)}>
                      <PendingButton className="btn-danger btn-sm">Blokir</PendingButton>
                    </form>
                  )}
                  <form action={adminDeleteApp.bind(null, a.id)}>
                    <PendingButton className="btn-danger btn-sm">Hapus</PendingButton>
                  </form>
                </span>
              </div>
              {appCreds.length > 0 && (
                <table className="table-base mt-3">
                  <thead><tr className="border-b text-left text-xs text-muted"><th>Credential</th><th>Hint</th><th>Dibuat</th><th></th></tr></thead>
                  <tbody>
                    {appCreds.map((c) => (
                      <tr key={c.id}>
                        <td>{c.type === 'key-auth' ? 'API Key' : 'JWT'}</td>
                        <td className="font-mono">…{c.hint}</td>
                        <td>{c.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                        <td className="text-right">
                          <form action={adminRevokeCredential.bind(null, a.id, c.id)}>
                            <PendingButton className="btn-danger btn-sm">Revoke</PendingButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
