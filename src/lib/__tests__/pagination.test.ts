import { describe, expect, it, vi } from 'vitest'
import { pageHref, parsePagination, resolvePagination } from '@/lib/pagination'

vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`) } }))

describe('pagination', () => {
  it('defaults safely and accepts only supported page sizes', () => {
    expect(parsePagination({})).toEqual({ requestedPage: 1, pageSize: 20 })
    expect(parsePagination({ page: '-2', rows: '500' })).toEqual({ requestedPage: 1, pageSize: 20 })
    expect(parsePagination({ page: '3', rows: '50' })).toEqual({ requestedPage: 3, pageSize: 50 })
  })

  it('preserves filters and resets page when changing page size', () => {
    expect(pageHref('/admin/users', { q: 'a b', status: 'active', page: '4' }, 2, 20))
      .toBe('/admin/users?q=a+b&status=active&page=2')
    expect(pageHref('/admin/users', { q: 'x', page: '4' }, 1, 50)).toBe('/admin/users?q=x&rows=50')
  })

  it('computes the current slice and redirects out-of-range pages', () => {
    expect(resolvePagination({ page: '2', rows: '10' }, '/admin/users', 25))
      .toEqual({ page: 2, pageSize: 10, totalPages: 3, offset: 10 })
    expect(() => resolvePagination({ page: '9', rows: '10' }, '/admin/users', 25))
      .toThrow('REDIRECT:/admin/users?page=3&rows=10')
    expect(() => resolvePagination({ page: '9' }, '/admin/users', 0))
      .toThrow('REDIRECT:/admin/users')
  })
})
