import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { apiProducts, applications, plans, subscriptions } from '@/db/schema'
import Markdown from 'react-markdown'
import { serviceLatencyP95 } from '@/lib/metrics'
import SubscribeForm from '@/components/SubscribeForm'
import TryIt from '@/components/TryIt'
import SpecHistory from '@/components/SpecHistory'
import ApiReference from '@/components/ApiReference'

function fmtLimits(rl: Record<string, number>) {
  return Object.entries(rl).map(([k, v]) => `${v}/${k}`).join(', ') || '-'
}

type OpenApiSpec = { paths?: Record<string, Record<string, { summary?: string }>> }

export default async function ApiDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await db.query.apiProducts.findFirst({
    where: and(eq(apiProducts.slug, slug), inArray(apiProducts.status, ['published', 'deprecated'])),
  })
  if (!product) notFound()
  const subscribable = product.status === 'published'

  const session = await auth()
  const allPlans = await db.select().from(plans).orderBy(plans.name)

  let myApps: { id: string; name: string }[] = []
  let mySubs: { applicationId: string; appName: string; status: string; planName: string }[] = []
  if (session?.user) {
    myApps = await db.select({ id: applications.id, name: applications.name })
      .from(applications).where(eq(applications.ownerUserId, session.user.id))
    if (myApps.length > 0) {
      mySubs = (await db.select({
        applicationId: subscriptions.applicationId,
        status: subscriptions.status,
        planId: subscriptions.planId,
      }).from(subscriptions).where(and(
        eq(subscriptions.apiProductId, product.id),
        inArray(subscriptions.applicationId, myApps.map((a) => a.id)),
      ))).map((s) => ({
        applicationId: s.applicationId,
        appName: myApps.find((a) => a.id === s.applicationId)?.name ?? '?',
        status: s.status,
        planName: allPlans.find((p) => p.id === s.planId)?.name ?? '?',
      }))
    }
  }
  const subscribableApps = myApps.filter((a) =>
    !mySubs.some((s) => s.applicationId === a.id && (s.status === 'requested' || s.status === 'approved')))
  const spec = product.openapiSpec as OpenApiSpec | null
  const latency = await serviceLatencyP95(product.kongServiceNames)

  return (
    <main className="page">
      <Link href="/" className="text-sm font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">← Katalog</Link>
      <div className="mt-2 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <span className="text-sm text-muted">v{product.version}</span>
        {product.status === 'deprecated' && (
          <span className="badge-warn">deprecated — tidak menerima subscription baru</span>
        )}
      </div>
      <div className="prose prose-sm mt-2 max-w-none text-ink-soft">
        <Markdown>{product.description}</Markdown>
      </div>
      <p className="mt-2 text-sm text-muted">Base URL: <code className="code-chip">{product.proxyBaseUrl}</code></p>
      {latency && latency.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          Latency p95 (24 jam): {latency.map((l) => `${l.service} ${l.p95Ms} ms`).join(' · ')}
        </p>
      )}

      <h2 className="section-title">Plans</h2>
      <table className="table-base max-w-lg">
        <thead><tr><th>Plan</th><th>Rate limit</th><th>Deskripsi</th></tr></thead>
        <tbody>
          {allPlans.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{p.name}</td>
              <td>{fmtLimits(p.rateLimit as Record<string, number>)}</td>
              <td className="text-muted">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="section-title">Subscribe</h2>
      {!session?.user ? (
        <p className="text-sm text-muted"><Link href="/auth/login" className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">Masuk</Link> untuk subscribe ke API ini.</p>
      ) : (
        <>
          {mySubs.length > 0 && (
            <ul className="mb-3 space-y-1 text-sm">
              {mySubs.map((s) => (
                <li key={s.applicationId}>
                  <b>{s.appName}</b> — plan {s.planName} — <span className="badge-muted">{s.status}</span>
                </li>
              ))}
            </ul>
          )}
          {subscribable ? (
            <SubscribeForm
              productId={product.id}
              hasApps={myApps.length > 0}
              apps={subscribableApps}
              plans={allPlans.map((p) => ({ id: p.id, name: p.name, limits: fmtLimits(p.rateLimit as Record<string, number>) }))}
            />
          ) : (
            <p className="text-sm text-warn">API ini deprecated — subscription baru ditutup.</p>
          )}
        </>
      )}

      {session?.user && (
        <>
          <h2 className="section-title">Try it</h2>
          <TryIt
            productId={product.id}
            baseUrl={product.proxyBaseUrl}
            endpoints={spec?.paths
              ? Object.entries(spec.paths).flatMap(([p, methods]) =>
                  Object.entries(methods).map(([method, op]) => ({ method, path: p, summary: op?.summary })))
              : []}
          />
        </>
      )}

      {spec?.paths && (
        <>
          <h2 className="section-title">Referensi API</h2>
          <ApiReference spec={spec} />
        </>
      )}

      <h2 className="section-title">Riwayat versi</h2>
      <SpecHistory productId={product.id} />
    </main>
  )
}
