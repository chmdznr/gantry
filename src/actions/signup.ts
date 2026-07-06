'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, emailVerificationTokens } from '@/db/schema'
import { hashPassword } from '@/lib/password'
import { verifyCaptchaAnswer } from '@/lib/captcha'
import { generateToken, tokenExpiry } from '@/lib/tokens'
import { sendVerificationEmail } from '@/lib/mailer'

const SignupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  organization: z.string().max(200).optional(),
  password: z.string().min(8).max(128),
  captcha: z.string().min(1),
})

function detectType(email: string): 'internal' | 'external' {
  const domains = (process.env.INTERNAL_EMAIL_DOMAINS ?? 'kai.id')
    .split(',').map((d) => d.trim().toLowerCase())
  const domain = email.split('@')[1]
  return domains.includes(domain) ? 'internal' : 'external'
}

export async function signup(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Input tidak valid. Periksa kembali isian Anda.' }
  const { name, email, organization, password, captcha } = parsed.data

  const jar = await cookies()
  const digest = jar.get('captcha_digest')?.value
  if (!digest || !verifyCaptchaAnswer(captcha, digest)) {
    return { error: 'Captcha salah. Coba lagi.' }
  }
  jar.delete('captcha_digest')

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) return { error: 'Email sudah terdaftar.' }

  try {
    await db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        name, email,
        organization: organization || null,
        passwordHash: await hashPassword(password),
        type: detectType(email),
      }).returning()

      const token = generateToken()
      await tx.insert(emailVerificationTokens).values({
        token, userId: user.id, expiresAt: tokenExpiry(24),
      })
      // kirim di dalam transaksi: gagal kirim -> rollback, email bisa dipakai daftar ulang
      await sendVerificationEmail(email, `${process.env.PORTAL_BASE_URL}/auth/verify?token=${token}`)
    })
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505') {
      return { error: 'Email sudah terdaftar.' }
    }
    console.error('[signup] failed:', err)
    return { error: 'Terjadi kesalahan saat mendaftar. Coba lagi nanti.' }
  }

  redirect('/auth/signup/success')
}
