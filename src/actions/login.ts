'use server'

import { AuthError } from 'next-auth'
import { signIn, signOut } from '@/auth'

export async function login(
  _prev: { error?: string },
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/',
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
