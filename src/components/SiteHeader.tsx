import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { auth } from '@/auth'
import { logout } from '@/actions/login'
import { getSiteContent } from '@/lib/site-content'
import NavLink from '@/components/NavLink'
import LocaleSwitcher from '@/components/LocaleSwitcher'

export function BrandMark({ appName }: { appName: string }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
      <span className="inline-block h-3.5 w-3.5 rounded-full border-4 border-band-ink/90 bg-amber" aria-hidden />
      {appName}
    </Link>
  )
}

// Header gelap yang sama untuk SEMUA halaman publik/developer — satu identitas.
export default async function SiteHeader() {
  const [session, t, c] = await Promise.all([auth(), getTranslations('nav'), getSiteContent(await getLocale())])
  return (
    <header className="bg-band text-band-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <BrandMark appName={c.appName} />
        <nav className="flex w-full flex-wrap items-center justify-end gap-2 text-sm sm:w-auto">
          <NavLink href="/#katalog" className="btn-ghost btn-sm border-transparent text-band-ink/80 hover:text-band-ink">{t('catalog')}</NavLink>
          {session?.user ? (
            <>
              <NavLink href="/apps" className="btn-ghost btn-sm" activeClassName="!border-transparent !bg-amber !text-accent-ink">{t('myApps')}</NavLink>
              <NavLink href="/account/security" className="btn-ghost btn-sm" activeClassName="!border-transparent !bg-amber !text-accent-ink">{t('security')}</NavLink>
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
  const [t, c] = await Promise.all([getTranslations('nav'), getSiteContent(await getLocale())])
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-muted">
        <span>{c.footer}</span>
        <span className="font-mono text-xs">{t('openSource')}</span>
      </div>
    </footer>
  )
}
