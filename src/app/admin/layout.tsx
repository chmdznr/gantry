import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { BRAND } from '@/lib/brand'
import AdminNav from '@/components/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session?.user?.role !== 'portal-admin') redirect('/auth/login')
  return (
    <div className="lg:flex lg:min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden bg-band text-band-ink lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-60 lg:shrink-0 lg:flex-col lg:gap-6 lg:overflow-y-auto lg:px-4 lg:py-6">
        <span className="flex items-center gap-2 px-2 font-display font-bold">
          <span className="inline-block h-3 w-3 rounded-full border-[3px] border-band-ink/90 bg-amber" aria-hidden />
          {BRAND.name} · Admin
        </span>
        <AdminNav />
      </aside>

      {/* Mobile top bar + drawer */}
      <details className="group bg-band text-band-ink lg:hidden">
        <summary aria-label="Admin menu" className="flex cursor-pointer items-center justify-between px-6 py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 font-display font-bold">
            <span className="inline-block h-3 w-3 rounded-full border-[3px] border-band-ink/90 bg-amber" aria-hidden />
            {BRAND.name} · Admin
          </span>
          <span className="text-sm text-band-ink/75" aria-hidden>Menu <span className="inline-block transition-transform group-open:rotate-180">▾</span></span>
        </summary>
        <div className="px-6 pb-4"><AdminNav /></div>
      </details>

      <div className="min-w-0 flex-1"><div className="mx-auto max-w-6xl px-6 py-8">{children}</div></div>
    </div>
  )
}
