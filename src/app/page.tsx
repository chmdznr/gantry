import Link from 'next/link'
import { desc, inArray } from 'drizzle-orm'
import { auth } from '@/auth'
import { logout } from '@/actions/login'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'

const steps = [
  { n: '1', t: 'Daftar & verifikasi', d: 'Buat akun dengan email organisasi Anda; admin menyetujui akses.' },
  { n: '2', t: 'Buat application', d: 'Satu application = satu identitas consumer di gateway.' },
  { n: '3', t: 'Subscribe API', d: 'Pilih API dan plan rate-limit; tunggu persetujuan admin.' },
  { n: '4', t: 'Pakai API key', d: 'Generate credential dan panggil API lewat gateway — coba langsung di Try It.' },
]

export default async function Home() {
  const session = await auth()
  const products = await db.select().from(apiProducts)
    .where(inArray(apiProducts.status, ['published', 'deprecated']))
    .orderBy(desc(apiProducts.updatedAt))

  return (
    <main>
      <header className="border-b bg-gray-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4">
          <span className="font-bold">KAI API Developer Portal</span>
          {session?.user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-300">{session.user.name}</span>
              <Link href="/apps" className="rounded bg-blue-600 px-3 py-1.5">Aplikasi Saya</Link>
              {session.user.role === 'portal-admin' && (
                <Link href="/admin/apis" className="rounded bg-gray-700 px-3 py-1.5">Admin</Link>
              )}
              <form action={logout}><button className="rounded border border-gray-600 px-3 py-1.5">Keluar</button></form>
            </div>
          ) : (
            <div className="flex gap-3 text-sm">
              <Link href="/auth/login" className="rounded bg-blue-600 px-3 py-1.5">Masuk</Link>
              <Link href="/auth/signup" className="rounded border border-gray-600 px-3 py-1.5">Daftar</Link>
            </div>
          )}
        </div>
        <div className="mx-auto max-w-5xl px-8 pt-10 pb-14">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight">
            Temukan, coba, dan integrasikan API internal KAI dari satu tempat.
          </h1>
          <p className="mt-4 max-w-xl text-gray-300">
            Katalog API ter-kurasi di atas Kong Gateway — lengkap dengan dokumentasi, credential self-service,
            kontrol rate limit per plan, dan statistik pemakaian aplikasi Anda.
          </p>
          {!session?.user && (
            <Link href="/auth/signup" className="mt-6 inline-block rounded bg-blue-600 px-5 py-2.5 font-semibold">
              Mulai — Daftar Sekarang
            </Link>
          )}
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-6 px-8 py-10 sm:grid-cols-4">
        {steps.map((s) => (
          <div key={s.n}>
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-bold text-white">{s.n}</div>
            <h3 className="font-semibold">{s.t}</h3>
            <p className="mt-1 text-sm text-gray-600">{s.d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-8 pb-16">
        <h2 className="mb-4 text-xl font-semibold">Katalog API</h2>
        {products.length === 0 ? (
          <p className="text-gray-500">Belum ada API yang dipublikasikan.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => (
              <Link key={p.id} href={`/apis/${p.slug}`}
                className="rounded-lg border p-4 transition hover:border-blue-500 hover:shadow">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  <span className="text-xs text-gray-500">v{p.version}</span>
                </div>
                {p.status === 'deprecated' && (
                  <span className="mt-1 inline-block rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">deprecated</span>
                )}
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{p.description}</p>
                {p.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.tags.map((t) => (
                      <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{t}</span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
