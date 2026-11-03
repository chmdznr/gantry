import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { plans, subscriptions } from '@/db/schema'
import { audit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db-errors'

// Operasi plan dipakai bersama oleh Server Action admin dan REST Admin API,
// supaya aturan validasi/konflik/audit tidak bercabang dua.
export const PLAN_LIMIT_WINDOWS = ['second', 'minute', 'hour', 'day'] as const

export type PlanLimitWindow = (typeof PLAN_LIMIT_WINDOWS)[number]

export type PlanRateLimit = Partial<Record<PlanLimitWindow, number>>

export type PlanInput = {
  name: string
  description?: string
  rateLimit: Partial<Record<PlanLimitWindow, unknown>>
}

export type PlanRecord = Pick<
  typeof plans.$inferSelect,
  'id' | 'name' | 'description' | 'rateLimit' | 'createdAt'
>

export type PlanActor = {
  userId: string
  tokenId?: string
  tokenPrefix?: string
}

export type CreatePlanResult =
  | { ok: true; plan: PlanRecord }
  | { ok: false; code: 'invalid_name' | 'no_limits' | 'duplicate' }

export type DeletePlanResult = { ok: true } | { ok: false; code: 'not_found' | 'in_use' }

// Form UI mengirim string; API mengirim number. Nilai tidak valid diabaikan,
// sama seperti perilaku form lama.
export function normalizePlanRateLimit(
  input: Partial<Record<PlanLimitWindow, unknown>> | null | undefined,
): PlanRateLimit {
  const limits: PlanRateLimit = {}
  for (const window of PLAN_LIMIT_WINDOWS) {
    const value = Number(input?.[window])
    if (Number.isFinite(value) && value > 0) limits[window] = value
  }
  return limits
}

function auditTokenFields(actor: PlanActor): Record<string, string> {
  return actor.tokenId && actor.tokenPrefix
    ? { tokenId: actor.tokenId, tokenPrefix: actor.tokenPrefix }
    : {}
}

export async function createPlanOperation(input: PlanInput, actor: PlanActor): Promise<CreatePlanResult> {
  const name = input.name.trim()
  const description = (input.description ?? '').trim()
  const rateLimit = normalizePlanRateLimit(input.rateLimit)
  if (name.length < 2) return { ok: false, code: 'invalid_name' }
  if (Object.keys(rateLimit).length === 0) return { ok: false, code: 'no_limits' }

  try {
    const [plan] = await db
      .insert(plans)
      .values({ name, description, rateLimit })
      .returning({
        id: plans.id,
        name: plans.name,
        description: plans.description,
        rateLimit: plans.rateLimit,
        createdAt: plans.createdAt,
      })
    await audit(actor.userId, 'plan.create', 'plan', plan.id, {
      name,
      limits: rateLimit,
      ...auditTokenFields(actor),
    })
    return { ok: true, plan }
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, code: 'duplicate' }
    throw err
  }
}

export async function deletePlanOperation(id: string, actor: PlanActor): Promise<DeletePlanResult> {
  const [existing] = await db.select({ id: plans.id }).from(plans).where(eq(plans.id, id)).limit(1)
  if (!existing) return { ok: false, code: 'not_found' }

  const used = await db.query.subscriptions.findFirst({ where: eq(subscriptions.planId, id) })
  if (used) return { ok: false, code: 'in_use' }

  const deleted = await db.delete(plans).where(eq(plans.id, id)).returning({ id: plans.id })
  if (deleted.length === 0) return { ok: false, code: 'not_found' }

  const token = auditTokenFields(actor)
  await audit(actor.userId, 'plan.delete', 'plan', id, Object.keys(token).length > 0 ? token : undefined)
  return { ok: true }
}
