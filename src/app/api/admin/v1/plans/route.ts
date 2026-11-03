import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { plans } from '@/db/schema'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { badRequest, conflict, jsonOk, parseJsonBody } from '@/lib/admin-api-http'
import { createPlanOperation } from '@/lib/admin-operations/plans'

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

const createPlanSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.'),
  description: z.string().trim().optional(),
  rateLimit: z
    .object({
      second: z.number().positive().optional(),
      minute: z.number().positive().optional(),
      hour: z.number().positive().optional(),
      day: z.number().positive().optional(),
    })
    .refine((limits) => Object.values(limits).some((value) => value !== undefined), {
      message: 'At least one rate limit (second/minute/hour/day) is required.',
    }),
})

export async function POST(req: Request) {
  const auth = await requireAdminApi(req, 'plans:write')
  if (!auth.ok) return auth.response

  const body = await parseJsonBody(req, createPlanSchema)
  if (!body.ok) return body.response

  const result = await createPlanOperation(body.data, {
    userId: auth.actor.userId,
    tokenId: auth.actor.tokenId,
    tokenPrefix: auth.actor.tokenPrefix,
  })
  if (!result.ok) {
    if (result.code === 'duplicate') return conflict('A plan with this name already exists.')
    return badRequest(
      result.code === 'invalid_name'
        ? 'Plan name must be at least 2 characters.'
        : 'At least one rate limit (second/minute/hour/day) is required.',
    )
  }

  revalidatePath('/admin/plans')
  return jsonOk(result.plan, { status: 201 })
}
