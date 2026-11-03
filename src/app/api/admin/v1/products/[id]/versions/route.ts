import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk } from '@/lib/admin-api-http'
import { listProductSpecVersions } from '@/lib/admin-operations/products'
import { productFailureResponse } from '../../_lib'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: RouteContext) {
  const auth = await requireAdminApi(req, 'read')
  if (!auth.ok) return auth.response

  const { id } = await params
  const result = await listProductSpecVersions(id)
  if (!result.ok) return productFailureResponse(result)
  return jsonOk(result.data)
}
