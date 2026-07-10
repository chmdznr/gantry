import Link from 'next/link'
import NavLink from '@/components/NavLink'

const GROUPS: { label: string; links: { href: string; text: string }[] }[] = [
  { label: 'Catalog', links: [
    { href: '/admin/apis', text: 'APIs' },
    { href: '/admin/plans', text: 'Plans' },
    { href: '/admin/subscriptions', text: 'Subscriptions' },
  ] },
  { label: 'Access', links: [
    { href: '/admin/consumers', text: 'Consumers' },
    { href: '/admin/users', text: 'Users' },
  ] },
  { label: 'Ops', links: [
    { href: '/admin/audit', text: 'Audit' },
    { href: '/admin/setup', text: 'Setup' },
    { href: '/admin/appearance', text: 'Appearance' },
  ] },
]

export default function AdminNav() {
  return (
    <nav className="flex flex-col gap-6">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-band-ink/50">{g.label}</p>
          <ul className="flex flex-col gap-0.5">
            {g.links.map((l) => (
              <li key={l.href}>
                <NavLink href={l.href}
                  className="block rounded-lg px-2 py-1.5 text-sm text-band-ink/75 hover:bg-band-ink/10 hover:text-band-ink"
                  activeClassName="!bg-amber !text-accent-ink font-semibold">
                  {l.text}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Link href="/" className="mt-2 px-2 text-sm text-band-ink/75 hover:text-band-ink hover:underline">← Portal</Link>
    </nav>
  )
}
