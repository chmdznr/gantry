'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/require-admin'
import {
  approveUserOperation,
  activateUserOperation,
  createUserOperation,
  setUserPasswordOperation,
  suspendUserOperation,
} from '@/lib/admin-operations/users'

// Approve oleh admin sekaligus dianggap verifikasi — kasus email instansi
// yang tidak bisa menerima email verifikasi (mail server pemerintah, dsb).
export async function approveUser(id: string) {
  const session = await requireAdmin()
  await approveUserOperation(id, { userId: session.user.id })
  revalidatePath('/admin/users')
}

export async function suspendUser(id: string) {
  const session = await requireAdmin()
  await suspendUserOperation(id, { userId: session.user.id })
  revalidatePath('/admin/users')
}

export async function activateUser(id: string) {
  const session = await requireAdmin()
  await activateUserOperation(id, { userId: session.user.id })
  revalidatePath('/admin/users')
}

export type SetPasswordState = { error?: string; ok?: string }

// Set password langsung oleh admin — untuk pengguna yang tidak bisa menerima
// email sama sekali; password dibagikan lewat jalur resmi instansi.
export async function adminSetPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const session = await requireAdmin()
  const result = await setUserPasswordOperation(
    String(formData.get('userId') ?? ''),
    { password: String(formData.get('password') ?? '') },
    { userId: session.user.id },
  )
  if (!result.ok) return { error: result.message }
  return { ok: `Password updated for ${result.user.email}.` }
}

export type CreateUserState = { error?: string; ok?: string; inviteLink?: string }

// Akun dibuatkan admin (mis. pengguna pemerintahan): langsung active + verified,
// password diatur sendiri oleh user lewat link set-password (reuse alur reset).
export async function adminCreateUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const session = await requireAdmin()
  const result = await createUserOperation(
    {
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      organization: String(formData.get('organization') ?? ''),
      type: formData.get('type') === 'internal' ? 'internal' : 'external',
    },
    { userId: session.user.id },
  )
  if (!result.ok) return { error: result.message }
  revalidatePath('/admin/users')
  return { ok: `Account for ${result.user.email} created (active, verified).`, inviteLink: result.inviteLink }
}
