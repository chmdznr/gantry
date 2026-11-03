import { desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { users } from '@/db/schema'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk, parseJsonBody } from '@/lib/admin-api-http'
import { createUserInput, createUserOperation } from '@/lib/admin-operations/users'
import { actorFrom, operationFailure } from './_helpers'

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

// Buat akun active+verified dan kembalikan satu-time invite link (72 jam).
// Link/token tidak pernah masuk audit atau log.
export async function POST(req: Request) {
  const auth = await requireAdminApi(req, 'users:write')
  if (!auth.ok) return auth.response

  const body = await parseJsonBody(req, createUserInput)
  if (!body.ok) return body.response

  const result = await createUserOperation(body.data, actorFrom(auth.actor))
  if (!result.ok) return operationFailure(result)

  revalidatePath('/admin/users')
  return jsonOk(
    { user: result.user, inviteLink: result.inviteLink, inviteExpiresAt: result.inviteExpiresAt },
    { status: 201 },
  )
}
