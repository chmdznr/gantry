'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Link nav dengan status aktif berdasarkan pathname (prefix match).
export default function NavLink({ href, exact = false, className = '', activeClassName = '', title, children }: {
  href: string
  exact?: boolean
  className?: string
  activeClassName?: string
  title?: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const target = href.split('#')[0] || '/'
  const active = exact ? pathname === target : pathname === target || pathname.startsWith(target + '/')
  return (
    <Link href={href} title={title} aria-current={active ? 'page' : undefined}
      className={`${className} ${active ? activeClassName : ''}`}>
      {children}
    </Link>
  )
}
