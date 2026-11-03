import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { apiProducts, applications, plans, subscriptions } from '@/db/schema'
import Markdown from 'react-markdown'
import { getTranslations } from 'next-intl/server'
import { serviceLatencyP95 } from '@/lib/metrics'
import { listServiceRoutes } from '@/lib/kong'
import { isEndpointRoutable, type GatewayRoute } from '@/lib/routable'
import { type FormField, type TryEndpoint, specHeaderParams } from '@/lib/tryit'
import SubscribeForm from '@/components/SubscribeForm'
import TryIt from '@/components/TryIt'
import SpecHistory from '@/components/SpecHistory'
import ApiReference from '@/components/ApiReference'

function fmtLimits(rl: Record<string, number>) {
  return Object.entries(rl).map(([k, v]) => `${v}/${k}`).join(', ') || '-'
}

type SpecSchema = {
  type?: string
  format?: string
  $ref?: string
  allOf?: unknown
  anyOf?: unknown
  oneOf?: unknown
  required?: string[]
  properties?: Record<string, SpecSchema>
  items?: SpecSchema
}
type OpenApiOperation = {
  summary?: string
  requestBody?: { content?: Record<string, { schema?: SpecSchema }> }
}
type OpenApiSpec = { paths?: Record<string, Record<string, OpenApiOperation>> }

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

// F6: media type body ditentukan dari requestBody.content, schema inline saja.
// $ref/allOf/anyOf/oneOf tidak pernah di-dereference: endpoint yang schema
// multipart-nya tidak bisa dibaca ditandai 'unsupported' (UI mematikan Try It).
function deriveBody(op: OpenApiOperation | undefined): Pick<TryEndpoint, 'bodyContentType' | 'formFields'> {
  const content = op?.requestBody?.content
  if (!content || Object.keys(content).length === 0) return { bodyContentType: 'application/json', formFields: [] }

  const multipart = content['multipart/form-data']
  if (multipart) {
    const schema = multipart.schema
    if (!schema || schema.$ref || schema.allOf || schema.anyOf || schema.oneOf) {
      return { bodyContentType: 'unsupported', formFields: [] }
    }
    const required = new Set(schema.required ?? [])
    const formFields: FormField[] = Object.entries(schema.properties ?? {}).map(([name, prop]) => {
      const p = prop ?? {}
      const isBinary = [p.format, p.items?.format].some((f) => f === 'binary' || f === 'byte')
      const composed = Boolean(p.$ref || p.allOf || p.anyOf || p.oneOf)
      return {
        name,
        type: isBinary ? 'binary' : 'text',
        required: required.has(name),
        ...(composed ? { unsupported: '$ref/composed schema not supported in v1' } : {}),
      }
    })
    return { bodyContentType: 'multipart/form-data', formFields }
  }

  if (content['application/json']) return { bodyContentType: 'application/json', formFields: [] }
  return { bodyContentType: 'unsupported', formFields: [] }
}

export default async function ApiDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const t = await getTranslations()
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

  // route gateway → endpoint spec yang tidak bisa di-route dinonaktifkan di Try It.
  // Kong tidak terjangkau → null → jangan blokir apa pun (konservatif).
  let gatewayRoutes: GatewayRoute[] | null = null
  if (session?.user && product.kongServiceNames.length > 0) {
    try {
      gatewayRoutes = (await Promise.all(product.kongServiceNames.map((s) => listServiceRoutes(s)))).flat()
    } catch {
      gatewayRoutes = null
    }
  }

  return (
    <main className="page">
      <Link href="/" className="text-sm font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">{t('catalog.backToCatalog')}</Link>
      <div className="mt-2 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <span className="text-sm text-muted">v{product.version}</span>
        {product.status === 'deprecated' && (
          <span className="badge-warn">{t('catalog.deprecatedBadge')}</span>
        )}
      </div>
      <div className="prose prose-sm mt-2 max-w-none text-ink-soft">
        <Markdown>{product.description}</Markdown>
      </div>
      <p className="mt-2 text-sm text-muted">{t('catalog.baseUrl')} <code className="code-chip">{product.proxyBaseUrl}</code></p>
      {latency && latency.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          {t('catalog.latency', { list: latency.map((l) => `${l.service} ${l.p95Ms} ms`).join(' · ') })}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        {/* Main column: the developer loop — Try It, then Reference */}
        <div className="order-1 space-y-10 lg:order-none">
          {session?.user && (
            <section>
              <h2 className="section-title !mt-0">{t('catalog.tryItTitle')}</h2>
              <TryIt
                productId={product.id}
                baseUrl={product.proxyBaseUrl}
                endpoints={spec?.paths
                  ? Object.entries(spec.paths).flatMap(([p, methods]) =>
                      Object.entries(methods)
                        .filter(([method]) => HTTP_METHODS.includes(method.toLowerCase()))
                        .map(([method, op]) => ({
                          method,
                          path: p,
                          summary: op?.summary,
                          routable: gatewayRoutes ? isEndpointRoutable(p, method, gatewayRoutes) : true,
                          ...deriveBody(op),
                          headerParams: specHeaderParams(methods, op),
                        })))
                  : []}
              />
            </section>
          )}

          {spec?.paths && (
            <section>
              <h2 className="section-title !mt-0">{t('catalog.referenceTitle')}</h2>
              <ApiReference spec={spec} />
            </section>
          )}
        </div>

        {/* Sidebar: Plans, Subscribe, quick facts — sticky on desktop */}
        <aside className="order-2 space-y-6 lg:sticky lg:top-6 lg:order-none lg:self-start">
          <section>
            <h2 className="section-title !mt-0">{t('catalog.plansTitle')}</h2>
            <table className="table-base">
              <thead><tr><th>{t('catalog.plan')}</th><th>{t('catalog.rateLimit')}</th><th>{t('catalog.description')}</th></tr></thead>
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
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">{t('catalog.subscribeTitle')}</h3>
            <div className="mt-2">
              {!session?.user ? (
                <p className="text-sm text-muted">{t.rich('catalog.signInToSubscribe', { link: (c) => <Link href="/auth/login" className="font-medium text-ink-soft underline decoration-amber decoration-2 underline-offset-2">{c}</Link> })}</p>
              ) : (
                <>
                  {mySubs.length > 0 && (
                    <ul className="mb-3 space-y-1 text-sm">
                      {mySubs.map((s) => (
                        <li key={s.applicationId}>
                          <b>{s.appName}</b> — {t('catalog.planWord')} {s.planName} — <span className="badge-muted">{s.status}</span>
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
                    <p className="text-sm text-warn">{t('catalog.subscribeClosed')}</p>
                  )}
                </>
              )}
            </div>
          </section>
        </aside>
      </div>

      <h2 className="section-title">{t('catalog.versionsTitle')}</h2>
      <SpecHistory productId={product.id} />
    </main>
  )
}
