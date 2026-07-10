import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'
import { auth } from '@/auth'
import { getSiteContent } from '@/lib/site-content'
import AdminNav from '@/components/AdminNav'
import SidebarToggle from '@/components/SidebarToggle'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (session?.user?.role !== 'portal-admin') redirect('/auth/login')
  const collapsed = (await cookies()).get('adminNav')?.value === 'collapsed'
  const c = await getSiteContent(await getLocale())
  return (
    <div className="lg:flex lg:min-h-screen">
      {/* Desktop sidebar — <aside> stretches to full container height (band bg always covers),
          the inner column is the sticky/scrolling nav so the spruce never "cuts off" at 1 screen. */}
      <aside className={`hidden bg-band text-band-ink lg:block lg:shrink-0 ${collapsed ? 'lg:w-16' : 'lg:w-60'}`}>
        <div className={`lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:px-3 lg:py-6 ${collapsed ? 'lg:overflow-visible' : 'lg:overflow-y-auto'}`}>
          <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : 'justify-between px-1'}`}>
            <span className="flex items-center gap-2 font-display font-bold">
              <span className="inline-block h-3 w-3 rounded-full border-[3px] border-band-ink/90 bg-amber" aria-hidden />
              {!collapsed && <span>{c.appName} · Admin</span>}
            </span>
            <SidebarToggle collapsed={collapsed} />
          </div>
          <AdminNav collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile top bar + drawer (always full labels) */}
      <details className="group bg-band text-band-ink lg:hidden">
        <summary aria-label="Admin menu" className="flex cursor-pointer items-center justify-between px-6 py-3 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2 font-display font-bold">
            <span className="inline-block h-3 w-3 rounded-full border-[3px] border-band-ink/90 bg-amber" aria-hidden />
            {c.appName} · Admin
          </span>
          <span className="text-sm text-band-ink/75" aria-hidden>Menu <span className="inline-block transition-transform group-open:rotate-180">▾</span></span>
        </summary>
        <div className="px-6 pb-4"><AdminNav /></div>
      </details>

      <div className="min-w-0 flex-1"><div className="mx-auto max-w-6xl px-6 py-8">{children}</div></div>
    </div>
  )
}
