import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session?.user?.role !== 'portal-admin') redirect('/auth/login')
  return (
    <div>
      <nav className="flex items-center gap-4 border-b bg-gray-900 px-6 py-3 text-white">
        <span className="font-bold">DevPortal Admin</span>
        <Link href="/admin/apis" className="text-sm hover:underline">APIs</Link>
        <Link href="/admin/plans" className="text-sm hover:underline">Plans</Link>
        <Link href="/admin/subscriptions" className="text-sm hover:underline">Subscriptions</Link>
        <Link href="/admin/consumers" className="text-sm hover:underline">Consumers</Link>
        <Link href="/admin/users" className="text-sm hover:underline">Users</Link>
        <Link href="/admin/audit" className="text-sm hover:underline">Audit</Link>
        <Link href="/admin/setup" className="text-sm hover:underline">Setup</Link>
        <Link href="/" className="ml-auto text-sm hover:underline">← Portal</Link>
      </nav>
      <div className="p-6">{children}</div>
    </div>
  )
}
