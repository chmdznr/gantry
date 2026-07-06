'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { users } from '@/db/schema'
import { audit } from '@/lib/audit'
import { requireAdmin } from '@/lib/require-admin'

async function setStatus(id: string, status: 'active' | 'suspended', action: string) {
  const session = await requireAdmin()
  const updated = await db.update(users).set({ status }).where(eq(users.id, id))
    .returning({ id: users.id })
  // audit hanya kalau update benar-benar terjadi (id salah/race -> no-op)
  if (updated.length > 0) await audit(session.user.id, action, 'user', id, { newStatus: status })
  revalidatePath('/admin/users')
}

export async function approveUser(id: string) { await setStatus(id, 'active', 'user.approve') }
export async function suspendUser(id: string) { await setStatus(id, 'suspended', 'user.suspend') }
export async function activateUser(id: string) { await setStatus(id, 'active', 'user.activate') }
