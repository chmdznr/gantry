import { desc } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk } from '@/lib/admin-api-http'

// Data user aman untuk API: tanpa passwordHash, sessionVersion, atau token.
export async function GET(req: Request) {
  const auth = await requireAdminApi(req, 'read')
  if (!auth.ok) return auth.response

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      organization: users.organization,
      type: users.type,
      status: users.status,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))

  return jsonOk(rows)
}
