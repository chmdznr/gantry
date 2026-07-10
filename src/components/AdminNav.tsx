import Link from 'next/link'
import NavLink from '@/components/NavLink'

type L = { href: string; text: string; icon: string }

const GROUPS: { label: string; links: L[] }[] = [
  { label: 'Catalog', links: [
    { href: '/admin/apis', text: 'APIs', icon: 'M4 17l6-6-6-6M12 19h8' },
    { href: '/admin/plans', text: 'Plans', icon: 'M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5' },
    { href: '/admin/subscriptions', text: 'Subscriptions', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11' },
  ] },
  { label: 'Access', links: [
    { href: '/admin/consumers', text: 'Consumers', icon: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12' },
    { href: '/admin/users', text: 'Users', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z' },
  ] },
  { label: 'Ops', links: [
    { href: '/admin/audit', text: 'Audit', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h6' },
    { href: '/admin/setup', text: 'Setup', icon: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6' },
    { href: '/admin/appearance', text: 'Appearance', icon: 'M12 2.5S5 9 5 14a7 7 0 0014 0c0-5-7-11.5-7-11.5z' },
  ] },
  { label: 'Site', links: [
    { href: '/admin/content', text: 'Site content', icon: 'M4 7V5a2 2 0 012-2h12a2 2 0 012 2v2M9 3v18M4 7h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7z' },
  ] },
]

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0" aria-hidden>
      <path d={d} />
    </svg>
  )
}

// Styled hover tooltip for the collapsed rail — appears instantly (no native-title delay),
// floats to the right of the icon over the content, using Atlas surface tokens.
function Tip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink shadow-lg group-hover:block">
      {text}
    </span>
  )
}

export default function AdminNav({ collapsed = false }: { collapsed?: boolean }) {
  const linkBase = `flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-band-ink/75 hover:bg-band-ink/10 hover:text-band-ink ${collapsed ? 'group relative justify-center' : ''}`
  return (
    <nav className="flex flex-col gap-6">
      {GROUPS.map((g) => (
        <div key={g.label}>
          {!collapsed && <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-band-ink/50">{g.label}</p>}
          <ul className="flex flex-col gap-0.5">
            {g.links.map((l) => (
              <li key={l.href}>
                <NavLink href={l.href} className={linkBase}
                  activeClassName="!bg-amber !text-accent-ink font-semibold">
                  <Icon d={l.icon} />
                  {collapsed ? <Tip text={l.text} /> : <span>{l.text}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Link href="/"
        className={`mt-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-band-ink/75 hover:bg-band-ink/10 hover:text-band-ink ${collapsed ? 'group relative justify-center' : ''}`}>
        <Icon d="M19 12H5M12 19l-7-7 7-7" />{collapsed ? <Tip text="Portal" /> : <span>Portal</span>}
      </Link>
    </nav>
  )
}
