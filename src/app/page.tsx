import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { logout } from '@/actions/login'
import { db } from '@/db'
import { apiProducts } from '@/db/schema'

export default async function Home() {
  const session = await auth()
  const products = await db.select().from(apiProducts)
    .where(eq(apiProducts.status, 'published'))
    .orderBy(desc(apiProducts.updatedAt))

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">KAI API Developer Portal</h1>
        {session?.user ? (
          <div className="flex items-center gap-3 text-sm">
            <span>{session.user.name} ({session.user.role})</span>
            <Link href="/apps" className="rounded bg-blue-600 px-3 py-1.5 text-white">Aplikasi Saya</Link>
            {session.user.role === 'portal-admin' && (
              <Link href="/admin/users" className="rounded bg-gray-800 px-3 py-1.5 text-white">Admin</Link>
            )}
            <form action={logout}><button className="rounded border px-3 py-1.5">Keluar</button></form>
          </div>
        ) : (
          <div className="flex gap-3 text-sm">
            <Link href="/auth/login" className="rounded bg-blue-600 px-3 py-1.5 text-white">Masuk</Link>
            <Link href="/auth/signup" className="rounded border px-3 py-1.5">Daftar</Link>
          </div>
        )}
      </div>

      <h2 className="mb-4 text-xl font-semibold">Katalog API</h2>
      {products.length === 0 ? (
        <p className="text-gray-500">Belum ada API yang dipublikasikan.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {products.map((p) => (
            <Link key={p.id} href={`/apis/${p.slug}`}
              className="rounded-lg border p-4 transition hover:border-blue-500 hover:shadow">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{p.name}</h3>
                <span className="text-xs text-gray-500">v{p.version}</span>
              </div>
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
    </main>
  )
}
