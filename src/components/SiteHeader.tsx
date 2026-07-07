import Link from 'next/link'
import { auth } from '@/auth'
import { logout } from '@/actions/login'
import { BRAND } from '@/lib/brand'
import NavLink from '@/components/NavLink'

export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
      <span className="inline-block h-3.5 w-3.5 rounded-full border-4 border-paper/90 bg-amber" aria-hidden />
      {BRAND.name}
    </Link>
  )
}

// Header gelap yang sama untuk SEMUA halaman publik/developer — satu identitas.
export default async function SiteHeader() {
  const session = await auth()
  return (
    <header className="bg-ink text-paper">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <BrandMark />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/#katalog" className="btn-ghost btn-sm border-transparent text-paper/80 hover:text-paper">Katalog</Link>
          {session?.user ? (
            <>
              <NavLink href="/apps" className="btn-ghost btn-sm" activeClassName="!border-transparent !bg-amber !text-ink">Aplikasi Saya</NavLink>
              {session.user.role === 'portal-admin' && (
                <NavLink href="/admin" className="btn-ghost btn-sm" activeClassName="!border-transparent !bg-amber !text-ink">Admin</NavLink>
              )}
              <form action={logout}>
                <button className="btn-ghost btn-sm">Keluar</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="btn-ghost btn-sm">Masuk</Link>
              <Link href="/auth/signup" className="btn-accent btn-sm">Daftar</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 text-sm text-muted">
        <span>{BRAND.name} — {BRAND.tagline}</span>
        <span className="font-mono text-xs">open source</span>
      </div>
    </footer>
  )
}
