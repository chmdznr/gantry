import { describe, it, expect } from 'vitest'
import { isUniqueViolation } from '../db-errors'

describe('isUniqueViolation', () => {
  it('deteksi code top-level (postgres-js langsung)', () => {
    expect(isUniqueViolation(Object.assign(new Error('dup'), { code: '23505' }))).toBe(true)
  })
  it('deteksi code di cause (DrizzleQueryError wrapper)', () => {
    const wrapped = new Error('Failed query')
    ;(wrapped as Error & { cause: unknown }).cause = Object.assign(new Error('dup'), { code: '23505' })
    expect(isUniqueViolation(wrapped)).toBe(true)
  })
  it('false untuk error lain', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false)
    expect(isUniqueViolation(Object.assign(new Error('fk'), { code: '23503' }))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})
