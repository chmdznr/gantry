import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { authorizeUser } from '@/lib/authorize'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // di belakang ingress/proxy K8s; host divalidasi di layer ingress
  // ponytail: 8 jam — suspend/demote baru efektif saat sesi habis; cek status per-aksi menyusul di Plan 2
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
