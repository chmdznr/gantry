import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authorizeUser } from '@/lib/authorize'
import { refreshSessionToken } from '@/lib/session-version'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // di belakang ingress/proxy K8s; host divalidasi di layer ingress
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  pages: { signIn: '/auth/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        return authorizeUser(String(creds?.email ?? '').toLowerCase(), String(creds?.password ?? ''))
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.sessionVersion = user.sessionVersion
        return token
      }
      return refreshSessionToken(token)
    },
    session({ session, token }) {
      session.user.id = token.sub!
      session.user.role = token.role as 'developer' | 'portal-admin'
      return session
    },
  },
})
