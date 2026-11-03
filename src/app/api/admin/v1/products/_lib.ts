import { badRequest, conflict, notFound } from '@/lib/admin-api-http'
import type { ProductFailure } from '@/lib/admin-operations/products'

export function productFailureResponse(failure: ProductFailure): Response {
  switch (failure.kind) {
    case 'validation': return badRequest(failure.message)
    case 'not_found': return notFound(failure.message)
    case 'conflict': return conflict(failure.message)
  }
}
