import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk, parseJsonBody } from '@/lib/admin-api-http'
import { PRODUCT_STATUSES, setProductStatusRecord } from '@/lib/admin-operations/products'
import { productFailureResponse } from '../../_lib'

const statusSchema = z.object({ status: z.enum(PRODUCT_STATUSES) })

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: RouteContext) {
  const auth = await requireAdminApi(req, 'products:write')
  if (!auth.ok) return auth.response

  const body = await parseJsonBody(req, statusSchema)
  if (!body.ok) return body.response

  const { id } = await params
  const result = await setProductStatusRecord(auth.actor, id, body.data.status)
  if (!result.ok) return productFailureResponse(result)
  return jsonOk(result.data)
}
