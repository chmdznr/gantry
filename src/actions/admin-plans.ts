'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/require-admin'
import { createPlanOperation, deletePlanOperation } from '@/lib/admin-operations/plans'

export type ActionState = { error?: string }

const CREATE_PLAN_ERRORS = {
  invalid_name: 'Nama plan minimal 2 karakter.',
  no_limits: 'Minimal satu limit (second/minute/hour/day) > 0.',
  duplicate: 'Nama plan sudah dipakai.',
} as const

export async function createPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireAdmin()
  const result = await createPlanOperation(
    {
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      rateLimit: {
        second: formData.get('second'),
        minute: formData.get('minute'),
        hour: formData.get('hour'),
        day: formData.get('day'),
      },
    },
    { userId: session.user.id },
  )
  if (!result.ok) return { error: CREATE_PLAN_ERRORS[result.code] }
  revalidatePath('/admin/plans')
  return {}
}

export async function deletePlan(id: string): Promise<void> {
  const session = await requireAdmin()
  const result = await deletePlanOperation(id, { userId: session.user.id })
  if (!result.ok) {
    if (result.code === 'in_use') throw new Error('Plan dipakai subscription — tidak bisa dihapus.')
    return
  }
  revalidatePath('/admin/plans')
}
