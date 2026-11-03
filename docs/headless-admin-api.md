# Headless Admin API

Bearer-token REST API for AI agents and automation. The browser admin UI still
uses NextAuth sessions; this API never falls back to cookies.

- Base path: `/api/admin/v1`
- Auth: `Authorization: Bearer gantry_admin_<43 base64url chars>`
- Content type: JSON only. No CORS headers are sent.
- Rate limit: 120 requests/minute per token (shared Redis limiter, in-memory
  fallback per instance).
- Responses are `Cache-Control: no-store`.

## Response envelope

Success:

```json
{ "data": { } }
```

Error:

```json
{ "error": { "code": "forbidden", "message": "Token is missing required scope: products:write." } }
```

`code` is machine-readable: `validation_error`, `unauthorized`, `forbidden`,
`not_found`, `conflict`, `payload_too_large`, `rate_limited`, `internal_error`.
`details` is present for validation failures and contains
`{ issues: [{ path, message }] }`.

## Scopes

| Scope | Grants |
| --- | --- |
| `read` | All GET endpoints |
| `products:write` | Product mutations |
| `plans:write` | Plan mutations |
| `users:write` | User mutations |
| `users:password` | Setting a user password |
| `subscriptions:write` | Subscription mutations |
| `consumers:write` | Consumer/credential mutations |

A token has exactly the scopes selected at creation. Write scopes do **not**
imply `read`; select both when an agent needs to read then mutate.

## Token lifecycle

Tokens are created at **Admin → API tokens** (`/admin/tokens`) by a portal admin.
Each token has:

- a name (for humans),
- one or more scopes,
- a fixed expiry of 7, 30, or 90 days (no non-expiring tokens).

The plain token is shown once. Only its SHA-256 hash and a short prefix
(`gantry_admin_` + first 8 random characters) are stored; there is no recovery.
Revoking sets `revoked_at` and takes effect on the next request.

Authentication checks, in order:

1. Missing/malformed `Authorization` header → `401`.
2. Unknown hash, expired `expires_at`, or non-null `revoked_at` → `401`.
3. Owner is not `active` or no longer `portal-admin` → `403`.
4. Token does not include the required scope → `403`.
5. Per-token rate limit exceeded → `429`.

`last_used_at` is updated best-effort on successful requests; a failed update
never fails the request.

## Current endpoints

| Method | Path | Scope | Notes |
| --- | --- | --- | --- |
| GET | `/api/admin/v1/setup` | `read` | Presence flags only; never secret values |
| GET | `/api/admin/v1/products` | `read` | Product list without `openapiSpec` |
| GET | `/api/admin/v1/plans` | `read` | Rate-limit plan list |
| GET | `/api/admin/v1/users` | `read` | No password hashes, session versions, or tokens |
| GET | `/api/admin/v1/openapi.json` | `read` | Minimal OpenAPI 3.1 document |

Example:

```bash
curl -H "Authorization: Bearer $GANTRY_ADMIN_TOKEN" \
  https://portal.example.go.id/api/admin/v1/products
```

## Shared modules for endpoint authors

`src/lib/admin-api-auth.ts`

```ts
export type AdminApiActor = {
  userId: string
  userEmail: string
  tokenId: string
  tokenPrefix: string
  scopes: AdminApiScope[]
}

export type AdminApiAuthResult =
  | { ok: true; actor: AdminApiActor }
  | { ok: false; response: Response }

export const ADMIN_API_RATE_LIMIT = { limit: 120, windowMs: 60_000 } as const

export async function requireAdminApi(
  req: Request,
  scope: AdminApiScope,
): Promise<AdminApiAuthResult>
```

Use it at the top of every handler:

```ts
const auth = await requireAdminApi(req, 'products:write')
if (!auth.ok) return auth.response
// auth.actor.userId / tokenId / tokenPrefix are available for audit metadata.
```

`src/lib/admin-api-http.ts`

```ts
jsonOk(data, init?)
jsonError(status, code, message, { details?, headers? })
badRequest(message?, details?)
unauthorized(message?)
forbidden(message?)
notFound(message?)
conflict(message?)
payloadTooLarge(message?)
tooManyRequests(message?)
serverError(message?)

// Parses + Zod-validates JSON, returns { ok: true, data } or { ok: false, response }.
parseJsonBody(req, schema, { maxBytes? })

DEFAULT_MAX_JSON_BYTES   // 1 MB
ADMIN_API_MAX_JSON_BYTES // 5 MB, for large OpenAPI spec bodies
```

`src/lib/admin-api-tokens.ts` holds the token format, hashing, scope catalog,
labels, and the Zod schema for token creation.

## Documentation ownership

Each endpoint-adding agent appends its own rows to "Current endpoints", its own
paths to `src/app/api/admin/v1/openapi.json/route.ts`, and (if needed) a new
section below describing request/response bodies. Do not rewrite the auth,
scope, or envelope sections: they are the foundation contract.
