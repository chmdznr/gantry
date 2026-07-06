'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { users } from '@/db/schema'
import { audit } from '@/lib/audit'
import { requireAdmin } from '@/lib/require-admin'

async function setStatus(id: string, status: 'active' | 'suspended', action: string) {
  const session = await requireAdmin()
  await db.update(users).set({ status }).where(eq(users.id, id))
  await audit(session.user.id, action, 'user', id)
  revalidatePath('/admin/users')
}

export async function approveUser(id: string) { await setStatus(id, 'active', 'user.approve') }
export async function suspendUser(id: string) { await setStatus(id, 'suspended', 'user.suspend') }
export async function activateUser(id: string) { await setStatus(id, 'active', 'user.activate') }
