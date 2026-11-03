import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { ADMIN_API_MAX_JSON_BYTES, jsonOk, parseJsonBody } from '@/lib/admin-api-http'
import { replaceProductSpec } from '@/lib/admin-operations/products'
import { productFailureResponse } from '../../_lib'

const specSchema = z.object({
  spec: z.custom<Record<string, unknown>>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
    'spec must be a JSON object.',
  ),
  changeNote: z.string().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

// 5 MiB mengikuti batas upload spec di form admin.
export async function PUT(req: Request, { params }: RouteContext) {
  const auth = await requireAdminApi(req, 'products:write')
  if (!auth.ok) return auth.response

  const body = await parseJsonBody(req, specSchema, { maxBytes: ADMIN_API_MAX_JSON_BYTES })
  if (!body.ok) return body.response

  const { id } = await params
  const result = await replaceProductSpec(auth.actor, id, body.data.spec, body.data.changeNote)
  if (!result.ok) return productFailureResponse(result)
  return jsonOk(result.data)
}
