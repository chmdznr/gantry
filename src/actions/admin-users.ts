'use server'

import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { passwordResetTokens, users } from '@/db/schema'
import { audit } from '@/lib/audit'
import { requireAdmin } from '@/lib/require-admin'
import { hashPassword } from '@/lib/password'
import { generateToken, tokenExpiry } from '@/lib/tokens'
import { sendInviteEmail } from '@/lib/mailer'
import { isUniqueViolation } from '@/lib/db-errors'

async function setStatus(id: string, status: 'active' | 'suspended', action: string) {
  const session = await requireAdmin()
  const updated = await db.update(users).set({ status }).where(eq(users.id, id))
    .returning({ id: users.id })
  // audit hanya kalau update benar-benar terjadi (id salah/race -> no-op)
  if (updated.length > 0) await audit(session.user.id, action, 'user', id, { newStatus: status })
  revalidatePath('/admin/users')
}

// Approve oleh admin sekaligus dianggap verifikasi — kasus email instansi
// yang tidak bisa menerima email verifikasi (mail server pemerintah, dsb).
export async function approveUser(id: string) {
  const session = await requireAdmin()
  const updated = await db.update(users)
    .set({ status: 'active', emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
    .where(eq(users.id, id))
    .returning({ id: users.id })
  if (updated.length > 0) await audit(session.user.id, 'user.approve', 'user', id, { newStatus: 'active' })
  revalidatePath('/admin/users')
}

export async function suspendUser(id: string) { await setStatus(id, 'suspended', 'user.suspend') }
export async function activateUser(id: string) { await setStatus(id, 'active', 'user.activate') }

export type SetPasswordState = { error?: string; ok?: string }

// Set password langsung oleh admin — untuk pengguna yang tidak bisa menerima
// email sama sekali; password dibagikan lewat jalur resmi instansi.
export async function adminSetPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const session = await requireAdmin()
  const userId = String(formData.get('userId') ?? '')
  const password = String(formData.get('password') ?? '')
  if (password.length < 8 || password.length > 128) return { error: 'Password must be 8–128 characters.' }
  const updated = await db.update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, userId))
    .returning({ email: users.email })
  if (updated.length === 0) return { error: 'User not found.' }
  // token reset lama tidak boleh bisa menimpa password yang baru di-set admin
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId))
  await audit(session.user.id, 'user.set_password', 'user', userId) // password TIDAK ikut di-audit
  return { ok: `Password updated for ${updated[0].email}.` }
}

export type CreateUserState = { error?: string; ok?: string; inviteLink?: string }

// Akun dibuatkan admin (mis. pengguna pemerintahan): langsung active + verified,
// password diatur sendiri oleh user lewat link set-password (reuse alur reset).
export async function adminCreateUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const session = await requireAdmin()
  const name = String(formData.get('name') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const organization = String(formData.get('organization') ?? '').trim() || null
  const type = formData.get('type') === 'internal' ? ('internal' as const) : ('external' as const)
  if (name.length < 3) return { error: 'Name must be at least 3 characters.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Invalid email address.' }

  let userId: string
  try {
    const [row] = await db.insert(users).values({
      email,
      name,
      organization,
      type,
      passwordHash: await hashPassword(generateToken()), // placeholder acak — diganti user via link
      status: 'active',
      emailVerifiedAt: new Date(),
    }).returning({ id: users.id })
    userId = row.id
  } catch (err) {
    if (isUniqueViolation(err)) return { error: `${email} is already registered.` }
    throw err
  }

  const token = generateToken()
  await db.insert(passwordResetTokens).values({ token, userId, expiresAt: tokenExpiry(72) })
  const inviteLink = `${process.env.PORTAL_BASE_URL}/auth/reset?token=${token}`
  await sendInviteEmail(email, inviteLink).catch((e) => console.error('[admin-users] invite mail failed:', e))
  await audit(session.user.id, 'user.create', 'user', userId, { email, type, createdBy: 'admin' })
  revalidatePath('/admin/users')
  return { ok: `Account for ${email} created (active, verified).`, inviteLink }
}
