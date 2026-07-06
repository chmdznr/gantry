import { auth } from '@/auth'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const user = req.auth?.user
  const loginUrl = new URL('/auth/login', req.url)

  if (pathname.startsWith('/admin') && user?.role !== 'portal-admin') {
    return Response.redirect(loginUrl)
  }
  if (pathname.startsWith('/apps') && !user) {
    return Response.redirect(loginUrl)
  }
})

export const config = { matcher: ['/admin/:path*', '/apps/:path*'] }
