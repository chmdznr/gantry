import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db } from '@/db'
import { applications } from '@/db/schema'
import NewAppForm from '@/components/NewAppForm'

export default async function AppsPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')
  const apps = await db.select().from(applications)
    .where(eq(applications.ownerUserId, session.user.id))
    .orderBy(desc(applications.createdAt))

  return (
    <main className="mx-auto max-w-4xl p-8">
      <Link href="/" className="text-sm text-blue-600 underline">← Katalog</Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">Aplikasi Saya</h1>
      <div className="mb-8"><NewAppForm /></div>
      {apps.length === 0 ? (
        <p className="text-gray-500">Belum ada application. Buat satu untuk mendapatkan credential API.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {apps.map((a) => (
            <Link key={a.id} href={`/apps/${a.id}`} className="rounded-lg border p-4 transition hover:border-blue-500 hover:shadow">
              <h3 className="font-semibold">{a.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{a.description || '—'}</p>
              <p className="mt-2 font-mono text-xs text-gray-400">{a.kongConsumerUsername}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
