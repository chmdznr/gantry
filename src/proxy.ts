import { auth } from '@/auth'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const user = req.auth?.user
  const loginUrl = new URL(`/auth/login?next=${encodeURIComponent(pathname)}`, req.url)

  if (pathname.startsWith('/admin') && user?.role !== 'portal-admin') {
    // sudah login tapi bukan admin -> ke home, bukan halaman login
    return Response.redirect(user ? new URL('/', req.url) : loginUrl)
  }
  if ((pathname.startsWith('/apps') || pathname.startsWith('/account')) && !user) {
    return Response.redirect(loginUrl)
  }
})

export const config = { matcher: ['/admin/:path*', '/apps/:path*', '/account/:path*'] }
