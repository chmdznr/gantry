import 'next-auth'

declare module 'next-auth' {
  interface User {
    role?: string
    sessionVersion?: number
  }
  interface Session {
    user: {
      id: string
      role: 'developer' | 'portal-admin'
      email?: string | null
      name?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    sessionVersion?: number
  }
}
