'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { adminApiTokens } from '@/db/schema'
import { audit } from '@/lib/audit'
import { requireAdmin } from '@/lib/require-admin'
import {
  createAdminApiTokenInput,
  expiryFromDays,
  generateAdminApiToken,
} from '@/lib/admin-api-tokens'
import { isUniqueViolation } from '@/lib/db-errors'

export type CreateTokenState = { error?: string; ok?: string; token?: string; name?: string }

export async function createAdminToken(
  _prev: CreateTokenState,
  formData: FormData,
): Promise<CreateTokenState> {
  const session = await requireAdmin()
  const parsed = createAdminApiTokenInput.safeParse({
    name: String(formData.get('name') ?? ''),
    scopes: [...new Set(formData.getAll('scopes').map(String))],
    expiresInDays: Number(formData.get('expiresInDays')),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid token settings.' }
  }

  const { name, scopes, expiresInDays } = parsed.data
  const generated = generateAdminApiToken()
  const expiresAt = expiryFromDays(expiresInDays)

  let tokenId: string
  try {
    const [row] = await db.insert(adminApiTokens).values({
      userId: session.user.id,
      name,
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      scopes,
      expiresAt,
    }).returning({ id: adminApiTokens.id })
    tokenId = row.id
  } catch (err) {
    if (isUniqueViolation(err)) return { error: 'Token collision — please try again.' }
    throw err
  }

  await audit(session.user.id, 'admin_api_token.create', 'admin_api_token', tokenId, {
    name,
    scopes,
    expiresAt: expiresAt.toISOString(),
  })
  revalidatePath('/admin/tokens')
  return {
    ok: `Token "${name}" created. Copy it now — it will not be shown again.`,
    token: generated.token,
    name,
  }
}

export async function revokeAdminToken(id: string): Promise<void> {
  const session = await requireAdmin()
  const updated = await db.update(adminApiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(adminApiTokens.id, id), isNull(adminApiTokens.revokedAt)))
    .returning({ id: adminApiTokens.id, name: adminApiTokens.name })
  if (updated.length > 0) {
    await audit(session.user.id, 'admin_api_token.revoke', 'admin_api_token', id, { name: updated[0].name })
  }
  revalidatePath('/admin/tokens')
}
