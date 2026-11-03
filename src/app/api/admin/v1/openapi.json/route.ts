import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk } from '@/lib/admin-api-http'

const ERROR_SCHEMA = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: {
          type: 'string',
          enum: [
            'validation_error',
            'unauthorized',
            'forbidden',
            'not_found',
            'conflict',
            'payload_too_large',
            'rate_limited',
            'internal_error',
          ],
        },
        message: { type: 'string' },
        details: {
          description:
            'Optional machine-readable details. Validation failures use `{ issues: [{ path, message }] }`; deleting a plan that is in use uses `{ code: "PLAN_IN_USE" }`; Kong failures use `{ upstream: "kong", status? }`.',
        },
      },
    },
  },
} as const

const ERROR_RESPONSES = {
  ValidationError: {
    description: 'Malformed JSON or body/domain validation failure.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  Unauthorized: {
    description: 'Missing/malformed bearer token, or the token is unknown, expired, or revoked.',
    headers: {
      'www-authenticate': { schema: { type: 'string' }, description: 'Always `Bearer`.' },
    },
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  Forbidden: {
    description:
      'The token owner is not an active portal admin, or the token lacks the scope required by this operation.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  NotFound: {
    description: 'The resource does not exist (or the path identifier is not a valid UUID).',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  Conflict: {
    description: 'The resource already exists or conflicts with its current state.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  PayloadTooLarge: {
    description: 'The request body exceeds the endpoint limit (1 MB by default, 5 MiB for product create and spec bodies).',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  RateLimited: {
    description: 'The per-token rate limit of 120 requests per minute was exceeded.',
    headers: {
      'retry-after': { schema: { type: 'string' }, description: 'Seconds to wait; currently `60`.' },
    },
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  InternalError: {
    description: 'Unexpected server error.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
  KongUnavailable: {
    description: 'The Kong Admin API could not be reached or returned an error.',
    content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
  },
} as const

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const responseRef = (name: string) => ({ $ref: `#/components/responses/${name}` })

// Dokumen OpenAPI 3.1 untuk semua endpoint Admin API. Setiap endpoint baru wajib
// menambahkan path dan schema-nya di sini; dokumen ini dikembalikan di dalam
// envelope `{ data }` seperti response Admin API lainnya.
const DOCUMENT = {
  openapi: '3.1.0',
  info: {
    title: 'Gantry Admin API',
    version: '1.0.0',
    description:
      'Headless Admin API for automation and AI agents. Authenticate with `Authorization: Bearer gantry_admin_...`; every operation requires a token scope, shown per operation as `x-required-scopes`. Responses use the `{ data }` success envelope and the `{ error: { code, message, details? } }` error envelope. Every response is `Cache-Control: no-store`. Rate limit: 120 requests per minute per token. JSON bodies are limited to 1 MB (1,000,000 bytes) by default and 5 MiB (5,242,880 bytes) for product create and product spec bodies.',
  },
  servers: [{ url: '/api/admin/v1' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
    responses: ERROR_RESPONSES,
    schemas: {
      Error: ERROR_SCHEMA,
      Setup: {
        type: 'object',
        required: ['api', 'version', 'time', 'integrations', 'scopes'],
        properties: {
          api: { type: 'string' },
          version: { type: 'string' },
          time: { type: 'string', format: 'date-time' },
          integrations: {
            type: 'object',
            description: 'Presence flags only; secret values are never returned.',
            required: ['database', 'redis', 'kong', 'smtp'],
            properties: {
              database: { type: 'boolean' },
              redis: { type: 'boolean' },
              kong: { type: 'boolean' },
              smtp: { type: 'boolean' },
            },
          },
          scopes: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'read',
                'products:write',
                'plans:write',
                'users:write',
                'users:password',
                'subscriptions:write',
                'consumers:write',
              ],
            },
          },
        },
      },
      Product: {
        type: 'object',
        required: [
          'id',
          'slug',
          'name',
          'description',
          'version',
          'status',
          'tags',
          'aclGroup',
          'proxyBaseUrl',
          'kongServiceNames',
          'createdAt',
          'updatedAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          slug: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          version: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'published', 'deprecated', 'retired'] },
          tags: { type: 'array', items: { type: 'string' } },
          aclGroup: { type: 'string' },
          proxyBaseUrl: { type: 'string' },
          kongServiceNames: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      ProductDetail: {
        description: 'Full product row. Unlike list rows, this includes `openapiSpec`.',
        allOf: [
          ref('Product'),
          {
            type: 'object',
            required: ['openapiSpec'],
            properties: {
              openapiSpec: {
                description:
                  'Stored OpenAPI document, or `null` when no spec has been uploaded. Product creation accepts any JSON value, so this is not constrained to an object.',
              },
            },
          },
        ],
      },
      ProductCreateInput: {
        type: 'object',
        required: ['slug', 'name', 'proxyBaseUrl', 'kongServiceNames'],
        properties: {
          slug: {
            type: 'string',
            pattern: '^[A-Za-z0-9-]{2,64}$',
            description: 'Trimmed and lowercased before validation.',
          },
          name: { type: 'string', minLength: 3 },
          description: { type: 'string' },
          version: { type: 'string', default: '1.0.0' },
          proxyBaseUrl: {
            type: 'string',
            pattern: '^https?://',
            description: 'Must start with `http://` or `https://`.',
          },
          aclGroup: { type: 'string', description: 'Defaults to the slug when omitted or blank.' },
          kongServiceNames: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 1 },
          },
          tags: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['draft', 'published'], default: 'draft' },
          spec: {
            description:
              'Initial OpenAPI document, or a Postman Collection v2.x that is converted to OpenAPI. Any JSON value is accepted here; the body limit is 5 MiB. A spec version snapshot is created when supplied.',
          },
          changeNote: { type: 'string', description: 'Stored on the initial spec version snapshot.' },
        },
      },
      ProductUpdateInput: {
        type: 'object',
        minProperties: 1,
        description: 'At least one field is required. Omitted fields keep their current values.',
        properties: {
          slug: { type: 'string', pattern: '^[A-Za-z0-9-]{2,64}$' },
          name: { type: 'string', minLength: 3 },
          description: { type: 'string' },
          version: { type: 'string' },
          proxyBaseUrl: { type: 'string', pattern: '^https?://' },
          aclGroup: { type: 'string' },
          kongServiceNames: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      ProductSpecReplaceInput: {
        type: 'object',
        required: ['spec'],
        properties: {
          spec: {
            type: 'object',
            additionalProperties: true,
            description:
              'OpenAPI document with a `paths` object, or a Postman Collection v2.x that is converted to OpenAPI first. The request body limit is 5 MiB. When the stored spec is unchanged, no new version is created and `specVersion` is `null`.',
          },
          changeNote: { type: 'string', description: 'Stored on the new spec version snapshot.' },
        },
      },
      ProductStatusInput: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['draft', 'published', 'deprecated', 'retired'] },
        },
      },
      SpecVersion: {
        type: 'object',
        required: ['id', 'version', 'changelog', 'note', 'createdBy', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          version: { type: 'string' },
          changelog: {
            type: ['object', 'null'],
            description: 'Endpoint diff between the previous and stored spec.',
            properties: {
              added: { type: 'array', items: { type: 'string' } },
              removed: { type: 'array', items: { type: 'string' } },
              changed: { type: 'array', items: { type: 'string' } },
            },
          },
          note: { type: ['string', 'null'] },
          createdBy: { type: ['string', 'null'], format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ProductSpecReplaceResult: {
        type: 'object',
        required: ['product', 'specVersion'],
        properties: {
          product: ref('ProductDetail'),
          specVersion: {
            description: 'Snapshot of the new spec, or `null` when the spec was unchanged.',
            oneOf: [ref('SpecVersion'), { type: 'null' }],
          },
        },
      },
      KongImportInput: {
        type: 'object',
        required: ['services'],
        properties: {
          services: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 1 },
            description: 'Kong service names to import as draft products.',
          },
        },
      },
      KongImportResult: {
        type: 'object',
        required: ['service', 'status'],
        properties: {
          service: { type: 'string' },
          status: {
            type: 'string',
            enum: ['imported', 'skippedExisting', 'error'],
            description:
              '`imported` created a draft product; `skippedExisting` means the service is already mapped or the derived slug is taken; `error` means the name cannot produce a valid slug or the insert failed.',
          },
          slug: { type: 'string', description: 'Derived slug, when available.' },
          productId: { type: 'string', format: 'uuid', description: 'Present only for `imported`.' },
          error: { type: 'string', description: 'Present only for `error`.' },
        },
      },
      KongService: {
        type: 'object',
        required: ['name', 'host', 'imported', 'products'],
        properties: {
          name: { type: 'string' },
          host: { type: 'string' },
          imported: { type: 'boolean' },
          products: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'slug'],
              properties: {
                id: { type: 'string', format: 'uuid' },
                slug: { type: 'string' },
              },
            },
          },
        },
      },
      Plan: {
        type: 'object',
        required: ['id', 'name', 'description', 'rateLimit', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          rateLimit: {
            type: 'object',
            description: 'Only the windows present in the plan are included.',
            properties: {
              second: { type: 'number', exclusiveMinimum: 0 },
              minute: { type: 'number', exclusiveMinimum: 0 },
              hour: { type: 'number', exclusiveMinimum: 0 },
              day: { type: 'number', exclusiveMinimum: 0 },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PlanCreateInput: {
        type: 'object',
        required: ['name', 'rateLimit'],
        properties: {
          name: { type: 'string', minLength: 2, description: 'Trimmed; must be unique.' },
          description: { type: 'string' },
          rateLimit: {
            type: 'object',
            minProperties: 1,
            description:
              'At least one window is required. Each supplied window must be a positive number.',
            properties: {
              second: { type: 'number', exclusiveMinimum: 0 },
              minute: { type: 'number', exclusiveMinimum: 0 },
              hour: { type: 'number', exclusiveMinimum: 0 },
              day: { type: 'number', exclusiveMinimum: 0 },
            },
          },
        },
      },
      User: {
        type: 'object',
        required: [
          'id',
          'email',
          'name',
          'organization',
          'type',
          'status',
          'role',
          'emailVerifiedAt',
          'createdAt',
        ],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          organization: { type: ['string', 'null'] },
          type: { type: 'string', enum: ['internal', 'external'] },
          status: { type: 'string', enum: ['pending', 'active', 'suspended'] },
          role: { type: 'string', enum: ['developer', 'portal-admin'] },
          emailVerifiedAt: { type: ['string', 'null'], format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      UserCreateInput: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string', minLength: 3 },
          email: { type: 'string', format: 'email', description: 'Trimmed and lowercased.' },
          organization: { type: ['string', 'null'] },
          type: { type: 'string', enum: ['internal', 'external'], default: 'external' },
        },
      },
      SetPasswordInput: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
      UserAction: {
        type: 'string',
        enum: ['approve', 'suspend', 'activate', 'password'],
        description:
          '`approve` sets status active and verifies the email; `suspend` and `activate` change status; `password` sets a new password directly and deletes outstanding reset tokens.',
      },
      SetupResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: ref('Setup') },
      },
      ProductListResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: { type: 'array', items: ref('Product') } },
      },
      ProductResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: ref('ProductDetail') },
      },
      ProductSpecResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: ref('ProductSpecReplaceResult') },
      },
      SpecVersionListResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: { type: 'array', items: ref('SpecVersion') } },
      },
      KongImportResponse: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: ['results'],
            properties: { results: { type: 'array', items: ref('KongImportResult') } },
          },
        },
      },
      KongServiceListResponse: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: ['services'],
            properties: { services: { type: 'array', items: ref('KongService') } },
          },
        },
      },
      PlanListResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: { type: 'array', items: ref('Plan') } },
      },
      PlanResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: ref('Plan') },
      },
      PlanDeletedResponse: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: ['id', 'deleted'],
            properties: {
              id: { type: 'string', format: 'uuid' },
              deleted: { const: true },
            },
          },
        },
      },
      UserListResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: { type: 'array', items: ref('User') } },
      },
      UserResponse: {
        type: 'object',
        required: ['data'],
        properties: { data: ref('User') },
      },
      UserCreateResponse: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: ['user', 'inviteLink', 'inviteExpiresAt'],
            properties: {
              user: ref('User'),
              inviteLink: {
                type: 'string',
                description:
                  'One-time set-password link containing a secret token. Returned only in this response, valid for 72 hours; never logged or audited. Store and deliver it as a secret.',
              },
              inviteExpiresAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      OpenApiDocumentResponse: {
        type: 'object',
        required: ['data'],
        properties: {
          data: {
            type: 'object',
            required: ['openapi', 'info', 'paths'],
            description:
              'The static OpenAPI 3.1 document for this API, returned inside the standard success envelope.',
            properties: {
              openapi: { type: 'string' },
              info: { type: 'object' },
              servers: { type: 'array', items: { type: 'object' } },
              security: { type: 'array', items: { type: 'object' } },
              components: { type: 'object' },
              paths: { type: 'object' },
            },
          },
        },
      },
    },
  },
  paths: {
    '/setup': {
      get: {
        summary: 'Safe setup summary',
        description: 'Configuration presence flags and the token scope catalog. Never returns secret values. Requires scope `read`.',
        operationId: 'getSetup',
        'x-required-scopes': ['read'],
        responses: {
          '200': {
            description: 'Configuration presence and scope catalog',
            content: { 'application/json': { schema: ref('SetupResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/products': {
      get: {
        summary: 'List API products',
        description: 'Newest-updated first. List rows omit `openapiSpec`. Requires scope `read`.',
        operationId: 'listProducts',
        'x-required-scopes': ['read'],
        responses: {
          '200': {
            description: 'Product list without `openapiSpec`',
            content: { 'application/json': { schema: ref('ProductListResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
      post: {
        summary: 'Create an API product',
        description:
          'Requires scope `products:write`. The request body may be up to 5 MiB. A Postman Collection v2.x supplied as `spec` is converted to OpenAPI. When a spec is supplied, an initial spec version snapshot is recorded.',
        operationId: 'createProduct',
        'x-required-scopes': ['products:write'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('ProductCreateInput') } },
        },
        responses: {
          '201': {
            description: 'Created product',
            content: { 'application/json': { schema: ref('ProductResponse') } },
          },
          '400': responseRef('ValidationError'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '409': responseRef('Conflict'),
          '413': responseRef('PayloadTooLarge'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/products/import': {
      post: {
        summary: 'Import Kong services as draft products',
        description:
          'Requires scope `products:write`. Each service is processed independently and the endpoint returns `200` with one result per requested service: `imported` (draft product created), `skippedExisting` (service already mapped or derived slug taken), or `error` (name cannot produce a valid slug, or insert failed). One failure never aborts the remaining services.',
        operationId: 'importKongServices',
        'x-required-scopes': ['products:write'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('KongImportInput') } },
        },
        responses: {
          '200': {
            description: 'Per-service import results',
            content: { 'application/json': { schema: ref('KongImportResponse') } },
          },
          '400': responseRef('ValidationError'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '413': responseRef('PayloadTooLarge'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/products/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Product UUID. Unknown values return `404`.',
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      get: {
        summary: 'Get an API product',
        description: 'Includes `openapiSpec` (possibly `null`). Requires scope `read`.',
        operationId: 'getProduct',
        'x-required-scopes': ['read'],
        responses: {
          '200': {
            description: 'Product detail',
            content: { 'application/json': { schema: ref('ProductResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
      patch: {
        summary: 'Update an API product',
        description:
          'Requires scope `products:write`. Partial update; the body must contain at least one field and is limited to 1 MiB. Omitted fields keep their values. Spec and status changes use their dedicated endpoints.',
        operationId: 'updateProduct',
        'x-required-scopes': ['products:write'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('ProductUpdateInput') } },
        },
        responses: {
          '200': {
            description: 'Updated product',
            content: { 'application/json': { schema: ref('ProductResponse') } },
          },
          '400': responseRef('ValidationError'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
          '409': responseRef('Conflict'),
          '413': responseRef('PayloadTooLarge'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/products/{id}/spec': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Product UUID. Unknown values return `404`.',
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      put: {
        summary: 'Replace an API product spec',
        description:
          'Requires scope `products:write`. The body may be up to 5 MiB. Accepts an OpenAPI document with a `paths` object, or a Postman Collection v2.x converted to OpenAPI. Every content change creates a spec version snapshot; an unchanged spec returns the current product with `specVersion: null` and creates nothing.',
        operationId: 'replaceProductSpec',
        'x-required-scopes': ['products:write'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('ProductSpecReplaceInput') } },
        },
        responses: {
          '200': {
            description: 'Updated product and the new spec version, or `null` when unchanged',
            content: { 'application/json': { schema: ref('ProductSpecResponse') } },
          },
          '400': responseRef('ValidationError'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
          '413': responseRef('PayloadTooLarge'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/products/{id}/status': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Product UUID. Unknown values return `404`.',
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      post: {
        summary: 'Set an API product status',
        description: 'Requires scope `products:write`. Accepts any product lifecycle status.',
        operationId: 'setProductStatus',
        'x-required-scopes': ['products:write'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('ProductStatusInput') } },
        },
        responses: {
          '200': {
            description: 'Product with the new status',
            content: { 'application/json': { schema: ref('ProductResponse') } },
          },
          '400': responseRef('ValidationError'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/products/{id}/versions': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Product UUID. Unknown values return `404`.',
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      get: {
        summary: 'List API product spec versions',
        description:
          'Newest first. Requires scope `read`. Returns summaries only; the stored `spec` body is deliberately omitted so responses stay small.',
        operationId: 'listProductSpecVersions',
        'x-required-scopes': ['read'],
        responses: {
          '200': {
            description: 'Spec version summaries without spec bodies',
            content: { 'application/json': { schema: ref('SpecVersionListResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/plans': {
      get: {
        summary: 'List rate-limit plans',
        description: 'Ordered by name. Requires scope `read`.',
        operationId: 'listPlans',
        'x-required-scopes': ['read'],
        responses: {
          '200': {
            description: 'Plan list',
            content: { 'application/json': { schema: ref('PlanListResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
      post: {
        summary: 'Create a rate-limit plan',
        description:
          'Requires scope `plans:write`. Plan names are unique. At least one rate-limit window (`second`, `minute`, `hour`, `day`) is required, and each supplied window must be a positive number.',
        operationId: 'createPlan',
        'x-required-scopes': ['plans:write'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('PlanCreateInput') } },
        },
        responses: {
          '201': {
            description: 'Created plan',
            content: { 'application/json': { schema: ref('PlanResponse') } },
          },
          '400': responseRef('ValidationError'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '409': responseRef('Conflict'),
          '413': responseRef('PayloadTooLarge'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/plans/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Plan UUID. Invalid or unknown values return `404`.',
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      get: {
        summary: 'Get a rate-limit plan',
        description: 'Requires scope `read`.',
        operationId: 'getPlan',
        'x-required-scopes': ['read'],
        responses: {
          '200': {
            description: 'Plan detail',
            content: { 'application/json': { schema: ref('PlanResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
      delete: {
        summary: 'Delete a rate-limit plan',
        description:
          'Requires scope `plans:write`. Plans referenced by subscriptions cannot be deleted: the response is `409` with `details.code: "PLAN_IN_USE"`.',
        operationId: 'deletePlan',
        'x-required-scopes': ['plans:write'],
        responses: {
          '200': {
            description: 'Plan deleted',
            content: { 'application/json': { schema: ref('PlanDeletedResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
          '409': responseRef('Conflict'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/users': {
      get: {
        summary: 'List portal users',
        description:
          'Newest first. Requires scope `read`. Never returns password hashes, session versions, or tokens.',
        operationId: 'listUsers',
        'x-required-scopes': ['read'],
        responses: {
          '200': {
            description: 'User list without credentials or tokens',
            content: { 'application/json': { schema: ref('UserListResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
      post: {
        summary: 'Create a portal user',
        description:
          'Requires scope `users:write`. The account is created active and verified, with a random placeholder password. The response contains a one-time invite link (72-hour set-password token); the link is never logged or audited, cannot be retrieved later, and email delivery failure does not fail the request.',
        operationId: 'createUser',
        'x-required-scopes': ['users:write'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: ref('UserCreateInput') } },
        },
        responses: {
          '201': {
            description: 'Created user plus the one-time invite link',
            content: { 'application/json': { schema: ref('UserCreateResponse') } },
          },
          '400': responseRef('ValidationError'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '409': responseRef('Conflict'),
          '413': responseRef('PayloadTooLarge'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/users/{id}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'User UUID. Invalid or unknown values return `404`.',
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      get: {
        summary: 'Get a portal user',
        description: 'Requires scope `read`. Never returns password hashes, session versions, or tokens.',
        operationId: 'getUser',
        'x-required-scopes': ['read'],
        responses: {
          '200': {
            description: 'User detail',
            content: { 'application/json': { schema: ref('UserResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/users/{id}/{action}': {
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'User UUID. Invalid or unknown values return `404`.',
          schema: { type: 'string', format: 'uuid' },
        },
        {
          name: 'action',
          in: 'path',
          required: true,
          description: 'Lifecycle action to run.',
          schema: ref('UserAction'),
        },
      ],
      post: {
        summary: 'Approve, suspend, activate, or set a password',
        description:
          '`approve`, `suspend`, and `activate` require scope `users:write` and no request body. `password` requires scope `users:password` (not granted by `users:write`) and the password body. Setting a password directly deletes outstanding reset/invite tokens. Unknown actions return `404`.',
        operationId: 'runUserAction',
        'x-required-scopes-by-action': {
          approve: ['users:write'],
          suspend: ['users:write'],
          activate: ['users:write'],
          password: ['users:password'],
        },
        requestBody: {
          required: false,
          description: 'Required only when `action` is `password`; omit it for the other actions.',
          content: { 'application/json': { schema: ref('SetPasswordInput') } },
        },
        responses: {
          '200': {
            description: 'Updated user',
            content: { 'application/json': { schema: ref('UserResponse') } },
          },
          '400': responseRef('ValidationError'),
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '404': responseRef('NotFound'),
          '413': responseRef('PayloadTooLarge'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
    '/kong/services': {
      get: {
        summary: 'List Kong services and their product mappings',
        description:
          'Requires scope `read`. Reads the Kong Admin API and marks each service as imported when a product references it. Returns `502` with `details.upstream: "kong"` when Kong is unreachable or errors; the failure is not cached.',
        operationId: 'listKongServices',
        'x-required-scopes': ['read'],
        responses: {
          '200': {
            description: 'Kong services with mapped products',
            content: { 'application/json': { schema: ref('KongServiceListResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
          '502': responseRef('KongUnavailable'),
        },
      },
    },
    '/openapi.json': {
      get: {
        summary: 'Get this OpenAPI document',
        description:
          'Requires scope `read`. Returns the static, JSON-serializable OpenAPI 3.1 document inside the standard `{ data }` success envelope.',
        operationId: 'getOpenApiDocument',
        'x-required-scopes': ['read'],
        responses: {
          '200': {
            description: 'OpenAPI 3.1 document',
            content: { 'application/json': { schema: ref('OpenApiDocumentResponse') } },
          },
          '401': responseRef('Unauthorized'),
          '403': responseRef('Forbidden'),
          '429': responseRef('RateLimited'),
          '500': responseRef('InternalError'),
        },
      },
    },
  },
} as const

export async function GET(req: Request) {
  const auth = await requireAdminApi(req, 'read')
  if (!auth.ok) return auth.response
  return jsonOk(DOCUMENT)
}
