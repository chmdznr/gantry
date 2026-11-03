import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_API_SCOPES,
  ADMIN_API_TOKEN_PREFIX,
  createAdminApiTokenInput,
  expiryFromDays,
  generateAdminApiToken,
  hashAdminApiToken,
  isAdminApiTokenFormat,
} from '../admin-api-tokens'

describe('admin API token helpers', () => {
  it('generates gantry_admin_ + 32 random bytes in base64url', () => {
    const { token } = generateAdminApiToken()
    expect(token.startsWith(ADMIN_API_TOKEN_PREFIX)).toBe(true)
    expect(token.slice(ADMIN_API_TOKEN_PREFIX.length)).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(isAdminApiTokenFormat(token)).toBe(true)
  })

  it('stores only the sha256 hash and a short prefix', () => {
    const { token, tokenHash, tokenPrefix } = generateAdminApiToken()
    expect(tokenHash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(tokenHash).toBe(hashAdminApiToken(token))
    expect(tokenHash).not.toContain(token)
    expect(tokenPrefix).toBe(token.slice(0, ADMIN_API_TOKEN_PREFIX.length + 8))
    expect(tokenPrefix.length).toBeLessThan(token.length)
  })

  it('produces unique tokens', () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateAdminApiToken().token))
    expect(tokens.size).toBe(20)
  })

  it('rejects malformed tokens', () => {
    expect(isAdminApiTokenFormat('')).toBe(false)
    expect(isAdminApiTokenFormat('gantry_admin_short')).toBe(false)
    expect(isAdminApiTokenFormat(` ${generateAdminApiToken().token}`)).toBe(false)
    expect(isAdminApiTokenFormat(generateAdminApiToken().token + 'x')).toBe(false)
    expect(isAdminApiTokenFormat('Bearer gantry_admin_x')).toBe(false)
    expect(isAdminApiTokenFormat(generateAdminApiToken().token.replace('_', '-'))).toBe(false)
  })

  it('validates token creation input', () => {
    const ok = createAdminApiTokenInput.safeParse({
      name: '  CI agent  ',
      scopes: ['read', 'products:write'],
      expiresInDays: 30,
    })
    expect(ok.success).toBe(true)
    if (ok.success) expect(ok.data.name).toBe('CI agent')

    expect(createAdminApiTokenInput.safeParse({ name: '  ', scopes: ['read'], expiresInDays: 30 }).success).toBe(false)
    expect(createAdminApiTokenInput.safeParse({ name: 'x', scopes: [], expiresInDays: 30 }).success).toBe(false)
    expect(createAdminApiTokenInput.safeParse({ name: 'x', scopes: ['root'], expiresInDays: 30 }).success).toBe(false)
    expect(createAdminApiTokenInput.safeParse({ name: 'x', scopes: ['read'], expiresInDays: 365 }).success).toBe(false)
  })

  it('computes expiry from days', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(expiryFromDays(7, now).toISOString()).toBe('2026-01-08T00:00:00.000Z')
    expect(expiryFromDays(30, now).toISOString()).toBe('2026-01-31T00:00:00.000Z')
    expect(expiryFromDays(90, now).toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })

  it('documents every supported scope', () => {
    expect(ADMIN_API_SCOPES).toEqual([
      'read',
      'products:write',
      'plans:write',
      'users:write',
      'users:password',
      'subscriptions:write',
      'consumers:write',
    ])
  })
})
