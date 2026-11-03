import { ADMIN_API_SCOPES } from '@/lib/admin-api-tokens'
import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk } from '@/lib/admin-api-http'

// Ringkasan setup yang aman: hanya status boolean keberadaan konfigurasi,
// tidak pernah menampilkan nilai env/secret.
export async function GET(req: Request) {
  const auth = await requireAdminApi(req, 'read')
  if (!auth.ok) return auth.response

  return jsonOk({
    api: 'gantry-admin-api',
    version: 'v1',
    time: new Date().toISOString(),
    integrations: {
      database: Boolean(process.env.DATABASE_URL),
      redis: Boolean(process.env.REDIS_URL),
      kong: Boolean(process.env.KONG_ADMIN_URL),
      smtp: Boolean(process.env.SMTP_HOST),
    },
    scopes: ADMIN_API_SCOPES,
  })
}
