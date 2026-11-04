import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { PAGE_SIZES, pageHref, type PageSearchParams } from '@/lib/pagination'

export default async function Pagination({ basePath, searchParams, page, pageSize, totalPages, total }: {
  basePath: string
  searchParams: PageSearchParams
  page: number
  pageSize: number
  totalPages: number
  total: number
}) {
  const t = await getTranslations('pagination')
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)
  return (
    <nav className="mt-5 flex flex-wrap items-center gap-3 text-sm" aria-label={t('label')}>
      <span className="text-muted tabular-nums">{t('showing', { first, last, total })}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className="btn-outline btn-sm" href={pageHref(basePath, searchParams, page - 1, pageSize)}>{t('previous')}</Link>
        ) : <span className="btn-outline btn-sm opacity-50" aria-disabled="true">{t('previous')}</span>}
        <span className="text-muted tabular-nums">{t('pageOf', { page, totalPages })}</span>
        {page < totalPages ? (
          <Link className="btn-outline btn-sm" href={pageHref(basePath, searchParams, page + 1, pageSize)}>{t('next')}</Link>
        ) : <span className="btn-outline btn-sm opacity-50" aria-disabled="true">{t('next')}</span>}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted">
        <span>{t('perPage')}</span>
        {PAGE_SIZES.map((size) => size === pageSize ? (
          <span key={size} className="badge-muted tabular-nums" aria-current="true">{size}</span>
        ) : (
          <Link key={size} className="px-1.5 py-0.5 underline tabular-nums"
            href={pageHref(basePath, searchParams, 1, size)}>{size}</Link>
        ))}
      </div>
    </nav>
  )
}
