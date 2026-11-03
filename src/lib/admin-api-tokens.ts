import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'

// Token Admin API: prefix tetap + 32 byte acak (base64url = 43 karakter).
// Plain token hanya dikembalikan sekali; DB menyimpan hash + prefix.
export const ADMIN_API_TOKEN_PREFIX = 'gantry_admin_'
const RANDOM_PART_LENGTH = 43
const TOKEN_PATTERN = new RegExp(`^${ADMIN_API_TOKEN_PREFIX}[A-Za-z0-9_-]{${RANDOM_PART_LENGTH}}$`)

export const ADMIN_API_SCOPES = [
  'read',
  'products:write',
  'plans:write',
  'users:write',
  'users:password',
  'subscriptions:write',
  'consumers:write',
] as const

export type AdminApiScope = (typeof ADMIN_API_SCOPES)[number]
export type AdminApiWriteScope = Exclude<AdminApiScope, 'read'>

export const ADMIN_API_SCOPE_LABELS: Record<AdminApiScope, string> = {
  read: 'Read (all GET endpoints)',
  'products:write': 'Products: write',
  'plans:write': 'Plans: write',
  'users:write': 'Users: write',
  'users:password': 'Users: set password',
  'subscriptions:write': 'Subscriptions: write',
  'consumers:write': 'Consumers: write',
}

export const ADMIN_API_EXPIRY_DAYS = [7, 30, 90] as const
export type AdminApiExpiryDays = (typeof ADMIN_API_EXPIRY_DAYS)[number]

export type GeneratedAdminApiToken = {
  token: string
  tokenHash: string
  tokenPrefix: string
}

export function hashAdminApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isAdminApiTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token)
}

export function generateAdminApiToken(): GeneratedAdminApiToken {
  const token = `${ADMIN_API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
  return {
    token,
    tokenHash: hashAdminApiToken(token),
    // Prefix cukup untuk membedakan token di UI tanpa membocorkan sisa rahasianya.
    tokenPrefix: token.slice(0, ADMIN_API_TOKEN_PREFIX.length + 8),
  }
}

export const createAdminApiTokenInput = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100, 'Name must be at most 100 characters.'),
  scopes: z.array(z.enum(ADMIN_API_SCOPES)).min(1, 'Select at least one scope.'),
  expiresInDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
})

export type CreateAdminApiTokenInput = z.infer<typeof createAdminApiTokenInput>

export function expiryFromDays(days: AdminApiExpiryDays, now = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 3600_000)
}
