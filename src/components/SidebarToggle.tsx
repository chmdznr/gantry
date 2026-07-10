'use client'

// Collapse/expand the admin sidebar. State persists in a cookie the server layout reads,
// so it survives navigation (admin uses full page loads).
export default function SidebarToggle({ collapsed }: { collapsed: boolean }) {
  return (
    <button type="button" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      onClick={() => {
        document.cookie = `adminNav=${collapsed ? 'expanded' : 'collapsed'}; path=/; max-age=31536000; samesite=lax`
        location.reload()
      }}
      className="flex items-center justify-center rounded-lg p-1.5 text-band-ink/60 hover:bg-band-ink/10 hover:text-band-ink">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
        {collapsed ? <path d="M9 18l6-6-6-6" /> : <path d="M15 18l-6-6 6-6" />}
      </svg>
    </button>
  )
}
