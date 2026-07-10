import Link from 'next/link'
import NavLink from '@/components/NavLink'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { BRAND } from '@/lib/brand'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session?.user?.role !== 'portal-admin') redirect('/auth/login')
  return (
    <div>
      <nav className="flex items-center gap-5 bg-band px-6 py-3 text-band-ink">
        <span className="flex items-center gap-2 font-display font-bold">
          <span className="inline-block h-3 w-3 rounded-full border-[3px] border-band-ink/90 bg-amber" aria-hidden />
          {BRAND.name} · Admin
        </span>
        <NavLink href="/admin/apis" className="border-b-2 border-transparent pb-0.5 text-sm text-band-ink/75 hover:text-band-ink" activeClassName="!border-amber font-semibold !text-band-ink">APIs</NavLink>
        <NavLink href="/admin/plans" className="border-b-2 border-transparent pb-0.5 text-sm text-band-ink/75 hover:text-band-ink" activeClassName="!border-amber font-semibold !text-band-ink">Plans</NavLink>
        <NavLink href="/admin/subscriptions" className="border-b-2 border-transparent pb-0.5 text-sm text-band-ink/75 hover:text-band-ink" activeClassName="!border-amber font-semibold !text-band-ink">Subscriptions</NavLink>
        <NavLink href="/admin/consumers" className="border-b-2 border-transparent pb-0.5 text-sm text-band-ink/75 hover:text-band-ink" activeClassName="!border-amber font-semibold !text-band-ink">Consumers</NavLink>
        <NavLink href="/admin/users" className="border-b-2 border-transparent pb-0.5 text-sm text-band-ink/75 hover:text-band-ink" activeClassName="!border-amber font-semibold !text-band-ink">Users</NavLink>
        <NavLink href="/admin/audit" className="border-b-2 border-transparent pb-0.5 text-sm text-band-ink/75 hover:text-band-ink" activeClassName="!border-amber font-semibold !text-band-ink">Audit</NavLink>
        <NavLink href="/admin/setup" className="border-b-2 border-transparent pb-0.5 text-sm text-band-ink/75 hover:text-band-ink" activeClassName="!border-amber font-semibold !text-band-ink">Setup</NavLink>
        <NavLink href="/admin/appearance" className="border-b-2 border-transparent pb-0.5 text-sm text-band-ink/75 hover:text-band-ink" activeClassName="!border-amber font-semibold !text-band-ink">Appearance</NavLink>
        <Link href="/" className="ml-auto text-sm text-band-ink/75 hover:text-band-ink hover:underline">← Portal</Link>
      </nav>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  )
}
