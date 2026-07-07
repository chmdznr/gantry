import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { BRAND } from '@/lib/brand'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session?.user?.role !== 'portal-admin') redirect('/auth/login')
  return (
    <div>
      <nav className="flex items-center gap-5 bg-ink px-6 py-3 text-paper">
        <span className="flex items-center gap-2 font-display font-bold">
          <span className="inline-block h-3 w-3 rounded-full border-[3px] border-paper/90 bg-amber" aria-hidden />
          {BRAND.name} · Admin
        </span>
        <Link href="/admin/apis" className="text-sm text-paper/75 decoration-amber decoration-2 underline-offset-4 hover:text-paper hover:underline">APIs</Link>
        <Link href="/admin/plans" className="text-sm text-paper/75 decoration-amber decoration-2 underline-offset-4 hover:text-paper hover:underline">Plans</Link>
        <Link href="/admin/subscriptions" className="text-sm text-paper/75 decoration-amber decoration-2 underline-offset-4 hover:text-paper hover:underline">Subscriptions</Link>
        <Link href="/admin/consumers" className="text-sm text-paper/75 decoration-amber decoration-2 underline-offset-4 hover:text-paper hover:underline">Consumers</Link>
        <Link href="/admin/users" className="text-sm text-paper/75 decoration-amber decoration-2 underline-offset-4 hover:text-paper hover:underline">Users</Link>
        <Link href="/admin/audit" className="text-sm text-paper/75 decoration-amber decoration-2 underline-offset-4 hover:text-paper hover:underline">Audit</Link>
        <Link href="/admin/setup" className="text-sm text-paper/75 decoration-amber decoration-2 underline-offset-4 hover:text-paper hover:underline">Setup</Link>
        <Link href="/" className="ml-auto text-sm text-paper/75 hover:text-paper hover:underline">← Portal</Link>
      </nav>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  )
}
