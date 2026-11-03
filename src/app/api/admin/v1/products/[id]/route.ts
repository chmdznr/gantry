import { z } from 'zod'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk, notFound, parseJsonBody } from '@/lib/admin-api-http'
import {
  getProductRecord,
  updateProductRecord,
} from '@/lib/admin-operations/products'
import { productFailureResponse } from '../_lib'

const updateProductSchema = z.object({
  slug: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
  proxyBaseUrl: z.string().optional(),
  aclGroup: z.string().optional(),
  kongServiceNames: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Provide at least one field to update.',
})

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteContext) {
  const auth = await requireAdminApi(req, 'read')
  if (!auth.ok) return auth.response

  const { id } = await params
  const product = await getProductRecord(id)
  if (!product) return notFound('Product not found.')
  return jsonOk(product)
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const auth = await requireAdminApi(req, 'products:write')
  if (!auth.ok) return auth.response

  const body = await parseJsonBody(req, updateProductSchema)
  if (!body.ok) return body.response

  const { id } = await params
  const result = await updateProductRecord(auth.actor, id, body.data)
  if (!result.ok) return productFailureResponse(result)
  return jsonOk(result.data)
}
