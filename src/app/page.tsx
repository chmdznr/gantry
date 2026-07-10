import Link from 'next/link'
import { desc, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { getTranslations } from 'next-intl/server'
import { BRAND } from '@/lib/brand'
import SiteHeader, { SiteFooter } from '@/components/SiteHeader'
import FilterBar, { countActive } from '@/components/FilterBar'

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string }> }) {
  const sp = await searchParams
  const t = await getTranslations('landing')
  const steps = t.raw('steps') as { t: string; d: string }[]
  const session = await auth()
  const products = await db.select().from(apiProducts)
    .where(inArray(apiProducts.status, ['published', 'deprecated']))
    .orderBy(desc(apiProducts.updatedAt))

  const allTags = [...new Set(products.flatMap((p) => p.tags))].sort()
  const q = sp.q?.trim().toLowerCase() ?? ''
  const tag = sp.tag ?? ''
  const shown = products.filter((p) =>
    (!q || p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q) || p.tags.some((tg) => tg.toLowerCase().includes(q))) &&
    (!tag || p.tags.includes(tag)))
  const activeCount = countActive(sp, ['q', 'tag'])

  return (
    <main>
      <SiteHeader />
      <section className="bg-band text-band-ink">
        <div className="mx-auto max-w-6xl px-6 pt-14 pb-16">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-band-accent">{BRAND.tagline}</p>
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] sm:text-5xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-5 max-w-xl text-band-ink/70">
            {t('heroText')}
          </p>
          {!session?.user && (
            <div className="mt-8 flex gap-3">
              <Link href="/auth/signup" className="btn-accent">{t('ctaStart')}</Link>
              <Link href="#katalog" className="btn-ghost">{t('ctaCatalog')}</Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="route-line">
          {steps.map((s) => (
            <div key={s.t} className="station">
              <h3 className="font-bold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="katalog" className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">{t('catalogTitle')}</h2>
          <span className="text-sm text-muted">{t('available', { count: shown.length })}</span>
        </div>
        <FilterBar resetHref="/#katalog" activeCount={activeCount}>
          <label className="text-sm">
            <span className="label">Search</span>
            <input name="q" defaultValue={sp.q ?? ''} placeholder="name / tag" className="input w-56" />
          </label>
          <label className="text-sm">
            <span className="label">Tag</span>
            <select name="tag" defaultValue={tag} className="input w-auto">
              <option value="">All</option>
              {allTags.map((tg) => <option key={tg} value={tg}>{tg}</option>)}
            </select>
          </label>
        </FilterBar>
        {shown.length === 0 ? (
          <div className="card text-muted">{t('empty')}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => {
              const paths = (p.openapiSpec as { paths?: Record<string, unknown> } | null)?.paths
              const endpointCount = paths ? Object.keys(paths).length : 0
              return (
                <Link key={p.id} href={`/apis/${p.slug}`} className="card-hover group">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-bold group-hover:text-ink-soft">{p.name}</h3>
                    <span className="font-mono text-xs text-muted">v{p.version}</span>
                  </div>
                  {p.status === 'deprecated' && <span className="badge-warn mt-2">deprecated</span>}
                  <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description}</p>
                  {(p.tags.length > 0 || endpointCount > 0) && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {p.tags.map((tg) => <span key={tg} className="badge-muted">{tg}</span>)}
                      {endpointCount > 0 && <span className="font-mono text-xs text-muted">{endpointCount} endpoints</span>}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  )
}
