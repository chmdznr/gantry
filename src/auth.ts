import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { verifyPassword } from '@/lib/password'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/auth/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? '').toLowerCase()
        const password = String(creds?.password ?? '')
        if (!email || !password) return null
        const user = await db.query.users.findFirst({ where: eq(users.email, email) })
        if (!user) return null
        if (!(await verifyPassword(password, user.passwordHash))) return null
        if (!user.emailVerifiedAt || user.status !== 'active') return null
        return { id: user.id, email: user.email, name: user.name, role: user.role }
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
