import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { plans } from '@/db/schema'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonError, jsonOk, notFound } from '@/lib/admin-api-http'
import { deletePlanOperation } from '@/lib/admin-operations/plans'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteContext) {
  const auth = await requireAdminApi(req, 'read')
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!z.uuid().safeParse(id).success) return notFound('Plan not found.')

  const [plan] = await db
    .select({
      id: plans.id,
      name: plans.name,
      description: plans.description,
      rateLimit: plans.rateLimit,
      createdAt: plans.createdAt,
    })
    .from(plans)
    .where(eq(plans.id, id))
    .limit(1)

  if (!plan) return notFound('Plan not found.')
  return jsonOk(plan)
}

export async function DELETE(req: Request, { params }: RouteContext) {
  const auth = await requireAdminApi(req, 'plans:write')
  if (!auth.ok) return auth.response

  const { id } = await params
  if (!z.uuid().safeParse(id).success) return notFound('Plan not found.')

  const result = await deletePlanOperation(id, {
    userId: auth.actor.userId,
    tokenId: auth.actor.tokenId,
    tokenPrefix: auth.actor.tokenPrefix,
  })
  if (!result.ok) {
    if (result.code === 'in_use') {
      return jsonError(409, 'conflict', 'Plan is in use by subscriptions and cannot be deleted.', {
        details: { code: 'PLAN_IN_USE' },
      })
    }
    return notFound('Plan not found.')
  }

  revalidatePath('/admin/plans')
  return jsonOk({ id, deleted: true })
}
