import { auth } from '@/auth'
import { logout } from '@/actions/login'

export default async function Home() {
  const session = await auth()
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-4 text-3xl font-bold">KAI API Developer Portal</h1>
      {session?.user ? (
        <div className="space-y-3">
          <p>Masuk sebagai <b>{session.user.name}</b> ({session.user.email}) — role: <b>{session.user.role}</b></p>
          <div className="flex gap-3">
            <a href="/apps" className="rounded bg-blue-600 px-4 py-2 text-white">Aplikasi Saya</a>
            {session.user.role === 'portal-admin' && (
              <a href="/admin/users" className="rounded bg-gray-800 px-4 py-2 text-white">Admin</a>
            )}
            <form action={logout}><button className="rounded border px-4 py-2">Keluar</button></form>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <a href="/auth/login" className="rounded bg-blue-600 px-4 py-2 text-white">Masuk</a>
          <a href="/auth/signup" className="rounded border px-4 py-2">Daftar</a>
        </div>
      )}
    </main>
  )
}
