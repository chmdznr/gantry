import Link from 'next/link'
import { desc, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'
import { BRAND } from '@/lib/brand'
import SiteHeader, { SiteFooter } from '@/components/SiteHeader'

const steps = [
  { t: 'Daftar & verifikasi', d: 'Buat akun dengan email organisasi; admin menyetujui akses Anda.' },
  { t: 'Buat application', d: 'Satu application menjadi satu identitas consumer di gateway.' },
  { t: 'Subscribe API', d: 'Pilih API dan plan rate-limit, lalu tunggu persetujuan.' },
  { t: 'Panggil dengan API key', d: 'Generate credential dan uji langsung dari Try It.' },
]

export default async function Home() {
  const session = await auth()
  const products = await db.select().from(apiProducts)
    .where(inArray(apiProducts.status, ['published', 'deprecated']))
    .orderBy(desc(apiProducts.updatedAt))

  return (
    <main>
      <SiteHeader />
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-5xl px-6 pt-14 pb-16">
          <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-amber">{BRAND.tagline}</p>
          <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] sm:text-5xl">
            Satu jalur dari katalog API sampai panggilan pertama.
          </h1>
          <p className="mt-5 max-w-xl text-paper/70">
            Temukan API yang ter-kurasi di gateway, dapatkan credential secara mandiri,
            dan pantau pemakaian aplikasi Anda — tanpa tiket, tanpa menunggu berhari-hari.
          </p>
          {!session?.user && (
            <div className="mt-8 flex gap-3">
              <Link href="/auth/signup" className="btn-accent">Mulai sekarang</Link>
              <Link href="#katalog" className="btn border border-paper/25 text-paper hover:bg-paper/10">Lihat katalog</Link>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="route-line">
          {steps.map((s) => (
            <div key={s.t} className="station">
              <h3 className="font-bold">{s.t}</h3>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="katalog" className="mx-auto max-w-5xl px-6 pb-20">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">Katalog API</h2>
          <span className="text-sm text-muted">{products.length} API tersedia</span>
        </div>
        {products.length === 0 ? (
          <div className="card text-muted">Belum ada API yang dipublikasikan. Admin dapat menambahkannya dari halaman Admin → APIs.</div>
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
