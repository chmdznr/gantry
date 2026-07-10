import Link from 'next/link'
import { desc, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { getTranslations } from 'next-intl/server'
import { BRAND } from '@/lib/brand'
import SiteHeader, { SiteFooter } from '@/components/SiteHeader'

export default async function Home() {
  const t = await getTranslations('landing')
  const steps = t.raw('steps') as { t: string; d: string }[]
  const session = await auth()
  const products = await db.select().from(apiProducts)
    .where(inArray(apiProducts.status, ['published', 'deprecated']))
    .orderBy(desc(apiProducts.updatedAt))

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
          <span className="text-sm text-muted">{t('available', { count: products.length })}</span>
        </div>
        {products.length === 0 ? (
          <div className="card text-muted">{t('empty')}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link key={p.id} href={`/apis/${p.slug}`} className="card-hover group">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-bold group-hover:text-ink-soft">{p.name}</h3>
                  <span className="font-mono text-xs text-muted">v{p.version}</span>
                </div>
                {p.status === 'deprecated' && <span className="badge-warn mt-2">deprecated</span>}
                <p className="mt-2 line-clamp-2 text-sm text-muted">{p.description}</p>
                {p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.tags.map((t) => <span key={t} className="badge-muted">{t}</span>)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  )
}
