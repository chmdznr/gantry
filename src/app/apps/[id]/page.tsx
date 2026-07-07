import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { apiProducts, appCredentials, applications, plans, subscriptions } from '@/db/schema'
import { deleteApp, revokeCredential } from '@/actions/apps'
import AppStats from '@/components/AppStats'
import CredentialCreator from '@/components/CredentialCreator'

const statusBadge: Record<string, string> = {
  requested: 'badge-warn',
  approved: 'badge-go',
  rejected: 'badge-stop',
  revoked: 'badge-muted',
}

export default async function AppDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user) redirect('/auth/login')

  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, id), eq(applications.ownerUserId, session.user.id)),
  })
  if (!app) notFound()

  const creds = await db.select().from(appCredentials)
    .where(eq(appCredentials.applicationId, id)).orderBy(desc(appCredentials.createdAt))
  const subs = await db.select({
    id: subscriptions.id,
    status: subscriptions.status,
    productName: apiProducts.name,
    productSlug: apiProducts.slug,
    planName: plans.name,
  }).from(subscriptions)
    .innerJoin(apiProducts, eq(subscriptions.apiProductId, apiProducts.id))
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.applicationId, id))

  return (
    <main className="page">
      <Link href="/apps" className="text-sm font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">← Aplikasi Saya</Link>
      <div className="mt-2 mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{app.name}</h1>
        {app.blockedAt && <span className="badge-stop">DIBLOKIR — hubungi admin</span>}
        <form action={deleteApp.bind(null, app.id)}>
          <button className="btn-danger btn-sm">Hapus App</button>
        </form>
      </div>
      <p className="text-sm text-muted">{app.description || '—'}</p>
      <p className="mt-1 font-mono text-xs text-muted">consumer: {app.kongConsumerUsername}</p>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Credentials</h2>
      <CredentialCreator appId={app.id} />
      {creds.length > 0 && (
        <table className="table-base mt-3">
          <thead><tr className="border-b text-left"><th className="py-1">Tipe</th><th>Hint</th><th>Dibuat</th><th></th></tr></thead>
          <tbody>
            {creds.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="py-1">{c.type === 'key-auth' ? 'API Key' : 'JWT'}</td>
                <td className="font-mono">…{c.hint}</td>
                <td>{c.createdAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td className="text-right">
                  <form action={revokeCredential.bind(null, app.id, c.id)}>
                    <button className="btn-danger btn-sm">Revoke</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="mt-8 mb-2 text-lg font-semibold">Pemakaian API</h2>
      <AppStats consumerUsername={app.kongConsumerUsername} />

      <h2 className="mt-8 mb-2 text-lg font-semibold">Subscriptions</h2>
      {subs.length === 0 ? (
        <p className="text-sm text-muted">Belum ada. Subscribe lewat halaman <Link href="/" className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">katalog</Link>.</p>
      ) : (
        <table className="table-base">
          <thead><tr className="border-b text-left"><th className="py-1">API</th><th>Plan</th><th>Status</th></tr></thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id} className="border-b">
                <td className="py-1"><Link href={`/apis/${s.productSlug}`} className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">{s.productName}</Link></td>
                <td>{s.planName}</td>
                <td><span className={`${statusBadge[s.status] ?? 'bg-gray-100'}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  )
}
