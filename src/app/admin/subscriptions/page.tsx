import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiProducts, applications, plans, subscriptions, users } from '@/db/schema'
import { approveSubscription, rejectSubscription, revokeSubscription } from '@/actions/subscriptions'

const badge: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  revoked: 'bg-gray-200 text-gray-700',
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
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2">Application</th><th>Pemilik</th><th>API</th><th>Plan</th><th>Diajukan</th><th>Status</th><th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="py-2">{s.appName}</td>
              <td>{s.ownerEmail}</td>
              <td>{s.productName}</td>
              <td>{s.planName}</td>
              <td>{s.requestedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
              <td><span className={`rounded px-2 py-0.5 text-xs ${badge[s.status]}`}>{s.status}</span></td>
              <td className="space-x-2 py-1">
                {s.status === 'requested' && (
                  <>
                    <form action={approveSubscription.bind(null, s.id)} className="inline">
                      <button className="rounded bg-green-600 px-2 py-1 text-xs text-white">Approve</button>
                    </form>
                    <form action={rejectSubscription.bind(null, s.id)} className="inline">
                      <button className="rounded bg-red-600 px-2 py-1 text-xs text-white">Reject</button>
                    </form>
                  </>
                )}
                {s.status === 'approved' && (
                  <form action={revokeSubscription.bind(null, s.id)} className="inline">
                    <button className="rounded bg-gray-700 px-2 py-1 text-xs text-white">Revoke</button>
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
