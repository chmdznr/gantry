import { db } from '@/db'
import { plans } from '@/db/schema'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk } from '@/lib/admin-api-http'

export async function GET(req: Request) {
  const auth = await requireAdminApi(req, 'read')
  if (!auth.ok) return auth.response

  const rows = await db
    .select({
      id: plans.id,
      name: plans.name,
      description: plans.description,
      rateLimit: plans.rateLimit,
      createdAt: plans.createdAt,
    })
    .from(plans)
    .orderBy(plans.name)

  return jsonOk(rows)
}
