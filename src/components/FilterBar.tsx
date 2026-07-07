import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

// Panel filter GET-form yang seragam untuk halaman daftar admin.
// Anak-anaknya: <label><span className="label">..</span><select|input name=".." className="input"/></label>
export default async function FilterBar({ resetHref, activeCount, children }: {
  resetHref: string
  activeCount: number
  children: React.ReactNode
}) {
  const t = await getTranslations('filters')
  return (
    <form className="card mb-5 flex flex-wrap items-end gap-3">
      {children}
      <div className="flex gap-2">
        <button className="btn-primary">{t('apply')}</button>
        {activeCount > 0 && <Link href={resetHref} className="btn-outline">{t('reset')}</Link>}
      </div>
    </form>
  )
}

export function countActive(sp: Record<string, string | undefined>, keys: string[]): number {
  return keys.filter((k) => sp[k]?.trim()).length
}
