import { afterEach, describe, expect, it, vi } from 'vitest'

const originalDatabaseUrl = process.env.DATABASE_URL

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
  vi.resetModules()
})

describe('database initialization', () => {
  it('defers configuration until runtime access and still fails fast when missing', async () => {
    delete process.env.DATABASE_URL
    vi.resetModules()

    const { db } = await import('@/db')

    expect(() => db.query).toThrow('DATABASE_URL is not set')
  })
})
