import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { adminApiTokens, users } from '@/db/schema'
import {
  ADMIN_API_SCOPES,
  hashAdminApiToken,
  isAdminApiTokenFormat,
  type AdminApiScope,
} from '@/lib/admin-api-tokens'
import { forbidden, tooManyRequests, unauthorized } from '@/lib/admin-api-http'
import { rateLimit } from '@/lib/rate-limit'

// Identitas pemanggil Admin API — dipakai untuk audit (userId + tokenId/prefix).
export type AdminApiActor = {
  userId: string
  userEmail: string
  tokenId: string
  tokenPrefix: string
  scopes: AdminApiScope[]
}

export type AdminApiAuthResult =
  | { ok: true; actor: AdminApiActor }
  | { ok: false; response: Response }

export const ADMIN_API_RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())
  return match ? match[1] : null
}

// Auth khusus header Bearer: TIDAK ada fallback ke cookie NextAuth.
// Token invalid/expired/revoked -> 401; owner tidak aktif/bukan portal-admin
// atau scope kurang -> 403.
export async function requireAdminApi(req: Request, scope: AdminApiScope): Promise<AdminApiAuthResult> {
  const token = bearerToken(req)
  if (!token || !isAdminApiTokenFormat(token)) {
    return { ok: false, response: unauthorized() }
  }

  const [row] = await db
    .select({
      tokenId: adminApiTokens.id,
      tokenPrefix: adminApiTokens.tokenPrefix,
      tokenScopes: adminApiTokens.scopes,
      expiresAt: adminApiTokens.expiresAt,
      revokedAt: adminApiTokens.revokedAt,
      userId: users.id,
      userStatus: users.status,
      userRole: users.role,
      userEmail: users.email,
    })
    .from(adminApiTokens)
    .innerJoin(users, eq(adminApiTokens.userId, users.id))
    .where(eq(adminApiTokens.tokenHash, hashAdminApiToken(token)))
    .limit(1)

  if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now()) {
    return { ok: false, response: unauthorized() }
  }

  if (row.userStatus !== 'active' || row.userRole !== 'portal-admin') {
    return { ok: false, response: forbidden("This token's owner is not an active portal admin.") }
  }

  if (!row.tokenScopes.includes(scope)) {
    return { ok: false, response: forbidden(`Token is missing required scope: ${scope}.`) }
  }

  if (!(await rateLimit(`admin-api:${row.tokenId}`, ADMIN_API_RATE_LIMIT.limit, ADMIN_API_RATE_LIMIT.windowMs))) {
    return { ok: false, response: tooManyRequests() }
  }

  // Best-effort: kegagalan mencatat pemakaian tidak boleh menggagalkan request.
  try {
    await db.update(adminApiTokens).set({ lastUsedAt: new Date() }).where(eq(adminApiTokens.id, row.tokenId))
  } catch {
    // sengaja diabaikan
  }

  const scopes = row.tokenScopes.filter((s): s is AdminApiScope =>
    (ADMIN_API_SCOPES as readonly string[]).includes(s),
  )

  return {
    ok: true,
    actor: {
      userId: row.userId,
      userEmail: row.userEmail,
      tokenId: row.tokenId,
      tokenPrefix: row.tokenPrefix,
      scopes,
    },
  }
}
