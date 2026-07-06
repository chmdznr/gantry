'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { plans, subscriptions } from '@/db/schema'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'

export type ActionState = { error?: string }

export async function createPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin()
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  const limits: Record<string, number> = {}
  for (const k of ['second', 'minute', 'hour', 'day'] as const) {
    const v = Number(formData.get(k))
    if (Number.isFinite(v) && v > 0) limits[k] = v
  }
  if (name.length < 2) return { error: 'Nama plan minimal 2 karakter.' }
  if (Object.keys(limits).length === 0) return { error: 'Minimal satu limit (second/minute/hour/day) > 0.' }

  try {
    const [row] = await db.insert(plans).values({ name, description, rateLimit: limits }).returning({ id: plans.id })
    await audit(session.user.id, 'plan.create', 'plan', row.id, { name, limits })
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ((err as Error)?.cause as { code?: string })?.code
    if (code === '23505') return { error: 'Nama plan sudah dipakai.' }
    throw err
  }
  revalidatePath('/admin/plans')
  return {}
}

export async function deletePlan(id: string): Promise<void> {
  const session = await requireAdmin()
  const used = await db.query.subscriptions.findFirst({ where: eq(subscriptions.planId, id) })
  if (used) throw new Error('Plan dipakai subscription — tidak bisa dihapus.')
  await db.delete(plans).where(eq(plans.id, id))
  await audit(session.user.id, 'plan.delete', 'plan', id)
  revalidatePath('/admin/plans')
}
