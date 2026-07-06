import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users, emailVerificationTokens } from '@/db/schema'

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) redirect('/auth/login?verify=invalid')

  const row = await db.query.emailVerificationTokens.findFirst({
    where: eq(emailVerificationTokens.token, token),
  })
  if (!row || row.expiresAt < new Date()) redirect('/auth/login?verify=invalid')

  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, row.userId))
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token))
  redirect('/auth/login?verify=ok')
}
