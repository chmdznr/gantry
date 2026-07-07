'use server'

import { AuthError } from 'next-auth'
import { signIn, signOut } from '@/auth'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export async function login(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  if (!(await rateLimit(`login:${await clientIp()}`, 10, 60_000))) {
    return { error: 'Terlalu banyak percobaan login. Tunggu sebentar.' }
  }
  // callbackUrl: hanya path internal — tolak //, backslash, dan apa pun yang
  // ter-resolve keluar origin (open redirect)
  const next = String(formData.get('next') ?? '')
  let redirectTo = '/'
  if (/^\/(?!\/)[^\\]*$/.test(next)) {
    const base = 'http://portal.internal'
    if (new URL(next, base).origin === base) redirectTo = next
  }
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo,
    })
    return {}
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Email atau password salah, atau akun belum aktif/terverifikasi.' }
    }
    throw err // redirect() dari signIn dilempar sebagai error — wajib re-throw
  }
}

export async function logout() {
  await signOut({ redirectTo: '/auth/login' })
}
