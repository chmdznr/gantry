import type { AdminApiActor } from '@/lib/admin-api-auth'
import { badRequest, conflict, notFound } from '@/lib/admin-api-http'
import type { UserActor, UserOperationFailure } from '@/lib/admin-operations/users'

export function actorFrom(actor: AdminApiActor): UserActor {
  return { userId: actor.userId, tokenId: actor.tokenId, tokenPrefix: actor.tokenPrefix }
}

export function operationFailure(failure: UserOperationFailure): Response {
  if (failure.status === 404) return notFound(failure.message)
  if (failure.status === 409) return conflict(failure.message)
  return badRequest(failure.message, failure.issues ? { issues: failure.issues } : undefined)
}
