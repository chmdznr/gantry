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
`{ issues: [{ path, message }] }`. Some endpoints add other machine-readable
detail shapes; see "Limits and error details".

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

## Endpoints

Every operation requires `Authorization: Bearer …` and the scope listed below.
Path parameters are UUIDs; invalid or unknown UUIDs return `404` unless noted.

| Method | Path | Scope | Notes |
| --- | --- | --- | --- |
| GET | `/api/admin/v1/setup` | `read` | Presence flags only; never secret values |
| GET | `/api/admin/v1/products` | `read` | Product list without `openapiSpec` |
| POST | `/api/admin/v1/products` | `products:write` | Create product; body up to 5 MiB |
| POST | `/api/admin/v1/products/import` | `products:write` | Import Kong services as draft products |
| GET | `/api/admin/v1/products/{id}` | `read` | Product detail, including `openapiSpec` |
| PATCH | `/api/admin/v1/products/{id}` | `products:write` | Partial product update |
| PUT | `/api/admin/v1/products/{id}/spec` | `products:write` | Replace spec; body up to 5 MiB |
| POST | `/api/admin/v1/products/{id}/status` | `products:write` | Set product lifecycle status |
| GET | `/api/admin/v1/products/{id}/versions` | `read` | Spec version summaries, without spec bodies |
| GET | `/api/admin/v1/plans` | `read` | Rate-limit plan list |
| POST | `/api/admin/v1/plans` | `plans:write` | Create rate-limit plan |
| GET | `/api/admin/v1/plans/{id}` | `read` | Plan detail |
| DELETE | `/api/admin/v1/plans/{id}` | `plans:write` | Delete unused plan |
| GET | `/api/admin/v1/users` | `read` | No password hashes, session versions, or tokens |
| POST | `/api/admin/v1/users` | `users:write` | Create user; returns a one-time invite link |
| GET | `/api/admin/v1/users/{id}` | `read` | User detail |
| POST | `/api/admin/v1/users/{id}/{action}` | `users:write` or `users:password` | `approve`/`suspend`/`activate` use `users:write`; `password` uses `users:password` |
| GET | `/api/admin/v1/kong/services` | `read` | Kong services and their mapped products |
| GET | `/api/admin/v1/openapi.json` | `read` | This OpenAPI 3.1 document, in the `{ data }` envelope |

Example:

```bash
curl -H "Authorization: Bearer $GANTRY_ADMIN_TOKEN" \
  https://portal.example.go.id/api/admin/v1/products
```

## Endpoint details

### Setup

`GET /setup` returns `{ data: { api, version, time, integrations, scopes } }`.
`integrations` contains booleans only: `database`, `redis`, `kong`, `smtp`.
`scopes` is the catalog of valid token scopes.

### Products

`GET /products` returns products ordered by most recently updated, without
`openapiSpec`. `GET /products/{id}` returns the full row including
`openapiSpec` (which may be `null`).

`POST /products` body:

```json
{
  "slug": "my-api",
  "name": "My API",
  "description": "Optional",
  "version": "1.0.0",
  "proxyBaseUrl": "https://api.example.go.id",
  "aclGroup": "my-api",
  "kongServiceNames": ["my-service"],
  "tags": ["public"],
  "status": "draft",
  "spec": { "openapi": "3.1.0", "paths": {} },
  "changeNote": "Initial upload"
}
```

Required: `slug` (`^[a-z0-9-]{2,64}$` after trimming/lowercasing), `name`
(at least 3 characters), `proxyBaseUrl` (must start with `http`), and a
non-empty `kongServiceNames`. `status` is `draft` or `published`;
`aclGroup` defaults to the slug. `spec` accepts any JSON: a Postman
Collection v2.x is converted to OpenAPI, and supplying a spec records an
initial spec version. The body may be up to **5 MiB** (5,242,880 bytes).
Returns `201` with the created product. A duplicate slug returns `409`.

`PATCH /products/{id}` accepts any subset of `slug`, `name`, `description`,
`version`, `proxyBaseUrl`, `aclGroup`, `kongServiceNames`, and `tags`; at
least one field is required. Spec and status changes have dedicated
endpoints. Returns the updated product. A duplicate slug returns `409`.

`PUT /products/{id}/spec` body:

```json
{ "spec": { "openapi": "3.1.0", "paths": {} }, "changeNote": "Optional" }
```

The body may be up to **5 MiB**. `spec` must produce an OpenAPI object with a
`paths` object after optional Postman Collection v2.x conversion. Every
content change creates a spec version snapshot; an identical spec returns the
current product with `specVersion: null`. Success:
`{ data: { product, specVersion } }`.

`POST /products/{id}/status` body: `{ "status": "published" }`, where status
is one of `draft`, `published`, `deprecated`, `retired`.

`GET /products/{id}/versions` returns spec version summaries
(`id`, `version`, `changelog`, `note`, `createdBy`, `createdAt`) newest first.
The stored `spec` itself is deliberately omitted.

`POST /products/import` body: `{ "services": ["service-a", "service-b"] }`.
Each service is processed independently and the endpoint returns `200` with
one result per requested service, even when some fail:

- `imported` — a draft product was created; includes `slug` and `productId`.
- `skippedExisting` — the service is already mapped to a product, or the
  derived slug is already taken; includes `slug` when derivable.
- `error` — the service name cannot produce a valid slug, or the insert
  failed; includes `error`.

One result never aborts the remaining services. Imported products use the
Kong proxy base URL and can be completed later with `PATCH`.

### Plans

`GET /plans` returns plans ordered by name. `GET /plans/{id}` returns one
plan. A plan is `{ id, name, description, rateLimit, createdAt }`.

`POST /plans` body:

```json
{
  "name": "Standard",
  "description": "Optional",
  "rateLimit": { "second": 10, "minute": 600 }
}
```

`name` must be at least 2 characters and unique; at least one positive
rate-limit window (`second`, `minute`, `hour`, `day`) is required, and each
supplied window must be a positive number. Returns `201` with the plan; a
duplicate name returns `409`.

`DELETE /plans/{id}` returns `{ data: { id, deleted: true } }`. A plan
referenced by any subscription cannot be deleted: the response is `409` with
`details.code: "PLAN_IN_USE"`.

### Users

`GET /users` and `GET /users/{id}` never return password hashes, session
versions, or tokens.

`POST /users` body:

```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.go.id",
  "organization": "ANRI",
  "type": "external"
}
```

`name` must be at least 3 characters, `email` is trimmed and lowercased, and
`type` is `internal` or `external` (default `external`). The account is
created active and verified with a random placeholder password. Returns
`201`:

```json
{
  "data": {
    "user": { "id": "...", "email": "ada@example.go.id" },
    "inviteLink": "https://portal.example.go.id/auth/reset?token=...",
    "inviteExpiresAt": "2026-11-07T12:00:00.000Z"
  }
}
```

**Invite link sensitivity.** `inviteLink` contains a one-time secret token
valid for 72 hours. It is returned only in this response, is never written to
audit logs or application logs, and cannot be retrieved later. Treat it as a
secret, deliver it only to the intended user, and do not paste it into tickets
or chat. If the invite email could not be sent, account creation still
succeeds and the link is still returned once. A duplicate email returns
`409`.

`POST /users/{id}/{action}` supports:

| Action | Scope | Body | Effect |
| --- | --- | --- | --- |
| `approve` | `users:write` | none | Set `active` and verify email |
| `suspend` | `users:write` | none | Set `suspended` |
| `activate` | `users:write` | none | Set `active` |
| `password` | `users:password` | `{ "password": "..." }` | Set password (8–128 chars) and delete outstanding reset/invite tokens |

All actions return the updated user. `users:write` does **not** grant
`users:password`. Unknown actions return `404`.

### Kong services

`GET /kong/services` returns:

```json
{
  "data": {
    "services": [
      {
        "name": "my-service",
        "host": "upstream.internal",
        "imported": true,
        "products": [{ "id": "...", "slug": "my-api" }]
      }
    ]
  }
}
```

`imported` is true when at least one product references the service. If the
Kong Admin API is unreachable or errors, the endpoint returns `502` with
`details.upstream: "kong"` (and `details.status` when Kong returned a status).

### OpenAPI document

`GET /openapi.json` returns the static OpenAPI 3.1 document inside the
standard `{ data }` envelope. It describes every endpoint, required scope,
request schema, and response/error convention. Keep it in sync when adding
endpoints; the route lives at
`src/app/api/admin/v1/openapi.json/route.ts`.

## Limits and error details

- JSON body limit: **1 MB** by default; **5 MiB** for `POST /products` and
  `PUT /products/{id}/spec`. Oversized bodies return `413`
  (`payload_too_large`).
- Rate limit: 120 requests/minute per token. Exceeding it returns `429`
  (`rate_limited`) with `Retry-After: 60`.
- `401` responses include `WWW-Authenticate: Bearer`.
- Validation failures (`400`) include
  `details.issues: [{ path, message }]`.
- `409` from plan deletion includes `details.code: "PLAN_IN_USE"`; `502` from
  Kong includes `details.upstream: "kong"`.
- A `500` (`internal_error`) means an unexpected server error.

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
ADMIN_API_MAX_JSON_BYTES // 5 MiB, for large OpenAPI spec bodies
```

`src/lib/admin-api-tokens.ts` holds the token format, hashing, scope catalog,
labels, and the Zod schema for token creation.

## Documentation ownership

Every implemented endpoint is documented above. When adding or changing an
endpoint, update the "Endpoints" table, the "Endpoint details" section, and
the matching path/schema in `src/app/api/admin/v1/openapi.json/route.ts`.
Do not rewrite the auth, scope, or envelope sections: they are the foundation
contract.
