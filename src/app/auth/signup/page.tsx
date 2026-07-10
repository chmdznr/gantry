import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import SignupClient from './SignupClient'

export default async function SignupPage() {
  if ((await auth())?.user) redirect('/')
  return <SignupClient />
}
