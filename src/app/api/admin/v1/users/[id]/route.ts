import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk, notFound } from '@/lib/admin-api-http'
import { safeUserColumns } from '@/lib/admin-operations/users'

type RouteContext = { params: Promise<{ id: string }> }

// Data user aman: tanpa passwordHash, sessionVersion, atau token.
export async function GET(req: Request, { params }: RouteContext) {
  const auth = await requireAdminApi(req, 'read')
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!z.uuid().safeParse(id).success) return notFound('User not found.')

  const [user] = await db.select(safeUserColumns).from(users).where(eq(users.id, id)).limit(1)
  if (!user) return notFound('User not found.')
  return jsonOk(user)
}
