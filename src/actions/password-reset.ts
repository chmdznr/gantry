'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { passwordResetTokens, users } from '@/db/schema'
import { hashPassword } from '@/lib/password'
import { generateToken, tokenExpiry } from '@/lib/tokens'
import { sendPasswordResetEmail } from '@/lib/mailer'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getTranslations } from 'next-intl/server'

export type ResetState = { error?: string; ok?: string }

// Tidak membocorkan apakah email terdaftar.
export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const t = await getTranslations('actions')
  if (!(await rateLimit(`pwreset:${await clientIp()}`, 3, 10 * 60_000))) {
    return { error: t('rateLimited') }
  }
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  if (!email.includes('@')) return { error: t('invalidEmail') }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (user && user.status === 'active') {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id))
    const token = generateToken()
    await db.insert(passwordResetTokens).values({ token, userId: user.id, expiresAt: tokenExpiry(1) })
    await sendPasswordResetEmail(email, `${process.env.PORTAL_BASE_URL}/auth/reset?token=${token}`).catch((e) =>
      console.error('[pwreset] mailer failed:', e))
  }
  return { ok: t('resetRequestOk') }
}

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const t = await getTranslations('actions')
  const token = String(formData.get('token') ?? '')
  const password = String(formData.get('password') ?? '')
  if (password.length < 8 || password.length > 128) return { error: t('passwordMin') }

  const row = await db.query.passwordResetTokens.findFirst({ where: eq(passwordResetTokens.token, token) })
  if (!row || row.expiresAt < new Date()) return { error: t('resetInvalid') }

  await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, row.userId))
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, row.userId))
  await audit(row.userId, 'user.password_reset', 'user', row.userId)
  redirect('/auth/login?reset=ok')
}
