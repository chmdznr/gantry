'use server'

import { eq, sql } from 'drizzle-orm'
import { getTranslations } from 'next-intl/server'
import { signOut } from '@/auth'
import { db } from '@/db'
import { passwordResetTokens, users } from '@/db/schema'
import { audit } from '@/lib/audit'
import { hashPassword, verifyPassword } from '@/lib/password'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { requireUser } from '@/lib/require-admin'

export type ChangePasswordState = { error?: string }

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await requireUser()
  const t = await getTranslations('actions')
  const currentPassword = String(formData.get('currentPassword') ?? '')
  const newPassword = String(formData.get('newPassword') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')

  if (newPassword.length < 8 || newPassword.length > 128) return { error: t('passwordLength') }
  if (newPassword !== confirmPassword) return { error: t('passwordMismatch') }
  if (newPassword === currentPassword) return { error: t('passwordUnchanged') }
  if (!(await rateLimit(`password-change:${session.user.id}:${await clientIp()}`, 5, 15 * 60_000))) {
    return { error: t('rateLimited') }
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { passwordHash: true },
  })
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return { error: t('currentPasswordInvalid') }
  }

  const passwordHash = await hashPassword(newPassword)
  await db.transaction(async (tx) => {
    const updated = await tx.update(users)
      .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, session.user.id))
      .returning({ id: users.id })
    if (updated.length === 0) throw new Error('Unauthorized')
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, session.user.id))
  })
  await audit(session.user.id, 'user.password_change', 'user', session.user.id)
  await signOut({ redirectTo: '/auth/login?reset=ok' })
  return {}
}
