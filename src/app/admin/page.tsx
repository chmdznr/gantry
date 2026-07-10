import Link from 'next/link'
import { count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiProducts, applications, subscriptions, users } from '@/db/schema'

async function n(promise: Promise<{ n: number }[]>) {
  return Number((await promise)[0]?.n ?? 0)
}

export default async function AdminDashboardPage() {
  const [apis, apps, activeSubs, userCount, pendingSubs, pendingUsers] = await Promise.all([
    n(db.select({ n: count() }).from(apiProducts).where(eq(apiProducts.status, 'published'))),
    n(db.select({ n: count() }).from(applications)),
    n(db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, 'approved'))),
    n(db.select({ n: count() }).from(users)),
    n(db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, 'requested'))),
    n(db.select({ n: count() }).from(users).where(eq(users.status, 'pending'))),
  ])

  const stats = [
    { label: 'Published APIs', value: apis },
    { label: 'Applications', value: apps },
    { label: 'Active subscriptions', value: activeSubs },
    { label: 'Users', value: userCount },
  ]

  return (
    <main>
      <h1 className="mb-6 text-xl font-bold">Dashboard</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Needs attention</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/subscriptions?status=requested" className="card-hover">
          <p className="font-semibold">Subscription requests</p>
          <p className="mt-1 text-sm text-muted">{pendingSubs > 0 ? `${pendingSubs} awaiting approval` : 'Nothing pending'}</p>
        </Link>
        <Link href="/admin/users?status=pending" className="card-hover">
          <p className="font-semibold">Pending users</p>
          <p className="mt-1 text-sm text-muted">{pendingUsers > 0 ? `${pendingUsers} awaiting approval` : 'Nothing pending'}</p>
        </Link>
      </div>
    </main>
  )
}
