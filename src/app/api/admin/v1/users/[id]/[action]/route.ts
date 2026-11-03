import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk, notFound, parseJsonBody } from '@/lib/admin-api-http'
import {
  activateUserOperation,
  approveUserOperation,
  setPasswordInput,
  setUserPasswordOperation,
  suspendUserOperation,
} from '@/lib/admin-operations/users'
import { actorFrom, operationFailure } from '../../_helpers'

type RouteContext = { params: Promise<{ id: string; action: string }> }

// password sengaja punya scope sendiri (users:password); scope users:write
// tidak boleh dipakai untuk mengganti password.
export async function POST(req: Request, { params }: RouteContext) {
  const { id, action } = await params
  if (!z.uuid().safeParse(id).success) return notFound('User not found.')

  if (action === 'password') {
    const auth = await requireAdminApi(req, 'users:password')
    if (!auth.ok) return auth.response

    const body = await parseJsonBody(req, setPasswordInput)
    if (!body.ok) return body.response

    const result = await setUserPasswordOperation(id, body.data, actorFrom(auth.actor))
    if (!result.ok) return operationFailure(result)
    revalidatePath('/admin/users')
    return jsonOk(result.user)
  }

  const auth = await requireAdminApi(req, 'users:write')
  if (!auth.ok) return auth.response

  const actor = actorFrom(auth.actor)
  const result =
    action === 'approve'
      ? await approveUserOperation(id, actor)
      : action === 'suspend'
        ? await suspendUserOperation(id, actor)
        : action === 'activate'
          ? await activateUserOperation(id, actor)
          : null
  if (!result) return notFound('Unknown user action.')
  if (!result.ok) return operationFailure(result)

  revalidatePath('/admin/users')
  return jsonOk(result.user)
}
