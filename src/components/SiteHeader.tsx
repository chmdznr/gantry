import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { logout } from '@/actions/login'
import { BRAND } from '@/lib/brand'
import NavLink from '@/components/NavLink'
import LocaleSwitcher from '@/components/LocaleSwitcher'

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
      <span className="inline-block h-3.5 w-3.5 rounded-full border-4 border-band-ink/90 bg-amber" aria-hidden />
      {BRAND.name}
    </Link>
  )
}

// Header gelap yang sama untuk SEMUA halaman publik/developer — satu identitas.
export default async function SiteHeader() {
  const [session, t] = await Promise.all([auth(), getTranslations('nav')])
  return (
    <header className="bg-band text-band-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <BrandMark />
        <nav className="flex items-center gap-2 text-sm">
          <NavLink href="/#katalog" className="btn-ghost btn-sm border-transparent text-band-ink/80 hover:text-band-ink">{t('catalog')}</NavLink>
          {session?.user ? (
            <>
              <NavLink href="/apps" className="btn-ghost btn-sm" activeClassName="!border-transparent !bg-amber !text-accent-ink">{t('myApps')}</NavLink>
              {session.user.role === 'portal-admin' && (
                <NavLink href="/admin" className="btn-ghost btn-sm" activeClassName="!border-transparent !bg-amber !text-accent-ink">{t('admin')}</NavLink>
              )}
              <form action={logout}>
                <button className="btn-ghost btn-sm">{t('signOut')}</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="btn-ghost btn-sm">{t('signIn')}</Link>
              <Link href="/auth/signup" className="btn-accent btn-sm">{t('signUp')}</Link>
            </>
          )}
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  )
}

export async function SiteFooter() {
  const t = await getTranslations('nav')
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted">
        <span>{BRAND.name} — {BRAND.tagline}</span>
        <span className="font-mono text-xs">{t('openSource')}</span>
      </div>
    </footer>
  )
}
