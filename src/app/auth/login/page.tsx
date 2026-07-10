import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import LoginClient from './LoginClient'

// Sudah login → tidak ada gunanya lihat form login (header admin + form login membingungkan).
// /auth/reset dan /auth/forgot sengaja TETAP bisa diakses saat login (kasus: admin membuka link invite user lain).
export default async function LoginPage() {
  if ((await auth())?.user) redirect('/')
  return <LoginClient />
}
