import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiProducts, applications, plans, subscriptions, users } from '@/db/schema'
import { approveSubscription, rejectSubscription, revokeSubscription } from '@/actions/subscriptions'
import PendingButton from '@/components/PendingButton'

const badge: Record<string, string> = {
  requested: 'badge-warn',
  approved: 'badge-go',
  rejected: 'badge-stop',
  revoked: 'badge-muted',
}

export default async function AdminSubscriptionsPage() {
  const rows = await db.select({
    id: subscriptions.id,
    status: subscriptions.status,
    requestedAt: subscriptions.requestedAt,
    appName: applications.name,
    ownerEmail: users.email,
    productName: apiProducts.name,
    planName: plans.name,
  }).from(subscriptions)
    .innerJoin(applications, eq(subscriptions.applicationId, applications.id))
    .innerJoin(users, eq(applications.ownerUserId, users.id))
    .innerJoin(apiProducts, eq(subscriptions.apiProductId, apiProducts.id))
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .orderBy(desc(subscriptions.requestedAt))

  return (
    <main>
      <h1 className="mb-4 text-xl font-bold">Subscriptions</h1>
      <table className="table-base">
        <thead>
          <tr>
            <th>Application</th><th>Pemilik</th><th>API</th><th>Plan</th><th>Diajukan</th><th>Status</th><th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>{s.appName}</td>
              <td>{s.ownerEmail}</td>
              <td>{s.productName}</td>
              <td>{s.planName}</td>
              <td>{s.requestedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
              <td><span className={`${badge[s.status]}`}>{s.status}</span></td>
              <td className="space-x-2">
                {s.status === 'requested' && (
                  <>
                    <form action={approveSubscription.bind(null, s.id)} className="inline">
                      <PendingButton className="btn-primary btn-sm">Approve</PendingButton>
                    </form>
                    <form action={rejectSubscription.bind(null, s.id)} className="inline">
                      <PendingButton className="btn-danger btn-sm">Reject</PendingButton>
                    </form>
                  </>
                )}
                {s.status === 'approved' && (
                  <form action={revokeSubscription.bind(null, s.id)} className="inline">
                    <PendingButton className="btn-outline btn-sm">Revoke</PendingButton>
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
