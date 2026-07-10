import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getAppName } from '@/lib/site-content'
import SignupClient from './SignupClient'

export default async function SignupPage() {
  if ((await auth())?.user) redirect('/')
  const appName = await getAppName()
  return <SignupClient appName={appName} />
}
