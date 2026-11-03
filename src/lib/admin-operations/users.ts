import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { passwordResetTokens, users } from '@/db/schema'
import { audit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db-errors'
import { hashPassword } from '@/lib/password'
import { sendInviteEmail } from '@/lib/mailer'
import { generateToken, tokenExpiry } from '@/lib/tokens'

// Operasi user dipakai bersama Server Action admin dan REST Admin API, supaya
// validasi/konflik/audit tidak bercabang dua dan pesan UI tetap sama.
export const INVITE_TTL_HOURS = 72

// Kolom aman untuk UI/API: tanpa passwordHash, sessionVersion, atau token.
export const safeUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  organization: users.organization,
  type: users.type,
  status: users.status,
  role: users.role,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
} as const

export type UserRecord = Pick<
  typeof users.$inferSelect,
  'id' | 'email' | 'name' | 'organization' | 'type' | 'status' | 'role' | 'emailVerifiedAt' | 'createdAt'
>

export type UserActor = {
  userId: string
  tokenId?: string
  tokenPrefix?: string
}

export type UserOperationFailure = {
  ok: false
  status: 400 | 404 | 409
  code: 'validation_error' | 'not_found' | 'conflict'
  message: string
  issues?: { path: string; message: string }[]
}

export type UserResult = { ok: true; user: UserRecord } | UserOperationFailure

export type CreateUserResult =
  | { ok: true; user: UserRecord; inviteLink: string; inviteExpiresAt: Date }
  | UserOperationFailure

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MESSAGE = 'Password must be 8–128 characters.'

export const createUserInput = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters.'),
  email: z.string().trim().toLowerCase().regex(EMAIL_PATTERN, 'Invalid email address.'),
  organization: z.string().trim().nullish(),
  type: z.enum(['internal', 'external']).default('external'),
})

export const setPasswordInput = z.object({
  password: z.string().min(8, PASSWORD_MESSAGE).max(128, PASSWORD_MESSAGE),
})

function auditTokenFields(actor: UserActor): Record<string, string> {
  return actor.tokenId && actor.tokenPrefix
    ? { tokenId: actor.tokenId, tokenPrefix: actor.tokenPrefix }
    : {}
}

function validationFailure(error: z.ZodError): UserOperationFailure {
  return {
    ok: false,
    status: 400,
    code: 'validation_error',
    message: error.issues[0]?.message ?? 'Invalid request.',
    issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  }
}

function notFoundFailure(): UserOperationFailure {
  return { ok: false, status: 404, code: 'not_found', message: 'User not found.' }
}

async function findUser(id: string): Promise<UserRecord | null> {
  const [user] = await db.select(safeUserColumns).from(users).where(eq(users.id, id)).limit(1)
  return user ?? null
}

// Akun dibuatkan admin: langsung active + verified, password diatur user lewat
// link set-password (reuse alur reset). Link/token TIDAK pernah masuk audit/log.
export async function createUserOperation(input: unknown, actor: UserActor): Promise<CreateUserResult> {
  const parsed = createUserInput.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)
  const { name, email, organization, type } = parsed.data

  let user: UserRecord
  try {
    const [row] = await db
      .insert(users)
      .values({
        email,
        name,
        organization: organization || null,
        type,
        passwordHash: await hashPassword(generateToken()), // placeholder acak — diganti user via link
        status: 'active',
        emailVerifiedAt: new Date(),
      })
      .returning(safeUserColumns)
    user = row
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, status: 409, code: 'conflict', message: `${email} is already registered.` }
    }
    throw err
  }

  const token = generateToken()
  const inviteExpiresAt = tokenExpiry(INVITE_TTL_HOURS)
  await db.insert(passwordResetTokens).values({ token, userId: user.id, expiresAt: inviteExpiresAt })
  const inviteLink = `${process.env.PORTAL_BASE_URL}/auth/reset?token=${token}`
  // Kegagalan email tidak menggagalkan pembuatan akun (link tetap dikembalikan).
  await sendInviteEmail(email, inviteLink).catch((e) => console.error('[admin-users] invite mail failed:', e))
  await audit(actor.userId, 'user.create', 'user', user.id, {
    email,
    type,
    createdBy: actor.tokenId ? 'admin-api' : 'admin',
    ...auditTokenFields(actor),
  })
  return { ok: true, user, inviteLink, inviteExpiresAt }
}

// Approve oleh admin sekaligus dianggap verifikasi. Audit hanya saat status atau
// verifikasi benar-benar berubah.
export async function approveUserOperation(id: string, actor: UserActor): Promise<UserResult> {
  const current = await findUser(id)
  if (!current) return notFoundFailure()

  const [user] = await db
    .update(users)
    .set({ status: 'active', emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
    .where(eq(users.id, id))
    .returning(safeUserColumns)
  if (!user) return notFoundFailure()

  if (current.status !== 'active' || current.emailVerifiedAt === null) {
    await audit(actor.userId, 'user.approve', 'user', id, {
      newStatus: 'active',
      ...auditTokenFields(actor),
    })
  }
  return { ok: true, user }
}

async function setStatusOperation(
  id: string,
  status: 'active' | 'suspended',
  action: string,
  actor: UserActor,
): Promise<UserResult> {
  const current = await findUser(id)
  if (!current) return notFoundFailure()
  if (current.status === status) return { ok: true, user: current }

  const [user] = await db.update(users).set({ status }).where(eq(users.id, id)).returning(safeUserColumns)
  if (!user) return notFoundFailure()

  await audit(actor.userId, action, 'user', id, {
    newStatus: status,
    ...auditTokenFields(actor),
  })
  return { ok: true, user }
}

export function suspendUserOperation(id: string, actor: UserActor): Promise<UserResult> {
  return setStatusOperation(id, 'suspended', 'user.suspend', actor)
}

export function activateUserOperation(id: string, actor: UserActor): Promise<UserResult> {
  return setStatusOperation(id, 'active', 'user.activate', actor)
}

// Password di-set admin langsung; token reset lama dihapus agar tidak bisa
// menimpa password baru. Password TIDAK ikut di-audit.
export async function setUserPasswordOperation(
  id: string,
  input: unknown,
  actor: UserActor,
): Promise<UserResult> {
  const parsed = setPasswordInput.safeParse(input)
  if (!parsed.success) return validationFailure(parsed.error)

  const current = await findUser(id)
  if (!current) return notFoundFailure()

  const passwordHash = await hashPassword(parsed.data.password)
  const [user] = await db.update(users).set({ passwordHash }).where(eq(users.id, id)).returning(safeUserColumns)
  if (!user) return notFoundFailure()

  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, id))
  const tokenFields = auditTokenFields(actor)
  await audit(actor.userId, 'user.set_password', 'user', id,
    Object.keys(tokenFields).length > 0 ? tokenFields : undefined)
  return { ok: true, user }
}
