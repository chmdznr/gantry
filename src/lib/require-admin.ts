import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { users } from '@/db/schema'

// Cek status/role dari DB, bukan hanya JWT — suspend/demote langsung efektif
// untuk semua aksi mutasi meski sesi lama masih hidup.
async function currentDbUser() {
  const session = await auth()
  if (!session?.user?.id) return null
  const u = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { status: true, role: true },
  })
  if (!u || u.status !== 'active') return null
  return { session, role: u.role }
}

export async function requireUser() {
  const cur = await currentDbUser()
  if (!cur) throw new Error('Unauthorized')
  return cur.session
}

export async function requireAdmin() {
  const cur = await currentDbUser()
  if (!cur || cur.role !== 'portal-admin') throw new Error('Forbidden')
  return cur.session
}
