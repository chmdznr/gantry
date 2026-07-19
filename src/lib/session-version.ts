import type { JWT } from 'next-auth/jwt'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

export async function refreshSessionToken(token: JWT): Promise<JWT | null> {
  if (!token.sub) return null
  const user = await db.query.users.findFirst({
    where: eq(users.id, token.sub),
    columns: { status: true, role: true, sessionVersion: true },
  })
  if (!user || user.status !== 'active') return null
  const tokenVersion = typeof token.sessionVersion === 'number' ? token.sessionVersion : 0
  if (tokenVersion !== user.sessionVersion) return null
  token.sessionVersion = user.sessionVersion
  token.role = user.role
  return token
}
