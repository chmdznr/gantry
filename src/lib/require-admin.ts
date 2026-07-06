import { auth } from '@/auth'

export async function requireAdmin() {
  const session = await auth()
  if (session?.user?.role !== 'portal-admin') throw new Error('Forbidden')
  return session
}

export async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Unauthorized')
  return session
}
