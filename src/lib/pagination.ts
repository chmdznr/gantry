import { redirect } from 'next/navigation'

export type PageSearchParams = Record<string, string | undefined>
export const PAGE_SIZES = [10, 20, 50] as const
export const DEFAULT_PAGE_SIZE = 20

export function pageHref(basePath: string, sp: PageSearchParams, page: number, pageSize: number): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (value && key !== 'page' && key !== 'rows') params.set(key, value)
  }
  if (page > 1) params.set('page', String(page))
  if (pageSize !== DEFAULT_PAGE_SIZE) params.set('rows', String(pageSize))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}

export function parsePagination(sp: PageSearchParams) {
  const requestedPage = Math.max(1, Math.floor(Number(sp.page) || 1))
  const rawSize = Number(sp.rows)
  const pageSize = (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE
  return { requestedPage, pageSize }
}

export function resolvePagination(sp: PageSearchParams, basePath: string, total: number) {
  const { requestedPage, pageSize } = parsePagination(sp)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (requestedPage > totalPages) redirect(pageHref(basePath, sp, totalPages, pageSize))
  return { page: requestedPage, pageSize, totalPages, offset: (requestedPage - 1) * pageSize }
}
