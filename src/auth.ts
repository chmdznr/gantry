import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authorizeUser } from '@/lib/authorize'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
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
      if (user) token.role = (user as { role: string }).role
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub!
      session.user.role = token.role as 'developer' | 'portal-admin'
      return session
    },
  },
})
