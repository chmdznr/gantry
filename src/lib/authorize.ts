import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { verifyPassword } from '@/lib/password'

export type AuthorizedUser = { id: string; email: string; name: string; role: string; sessionVersion: number }

export async function authorizeUser(email: string, password: string): Promise<AuthorizedUser | null> {
  if (!email || !password) return null
  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (!user) return null
  if (!(await verifyPassword(password, user.passwordHash))) return null
  if (!user.emailVerifiedAt || user.status !== 'active') return null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sessionVersion: user.sessionVersion,
  }
}
