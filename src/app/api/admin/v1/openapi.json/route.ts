import { requireAdminApi } from '@/lib/admin-api-auth'
import { jsonOk } from '@/lib/admin-api-http'

const errorResponse = {
  description: 'Error envelope',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
}

// Dokumen OpenAPI minimal untuk endpoint read foundation. Endpoint baru wajib
// menambahkan path-nya sendiri di sini (atau menggabungkan dokumen terpisah).
const DOCUMENT = {
  openapi: '3.1.0',
  info: {
    title: 'Gantry Admin API',
    version: '1.0.0',
    description:
      'Headless Admin API. Authenticate with `Authorization: Bearer gantry_admin_...`; token harus memiliki scope yang sesuai (read untuk GET).',
  },
  servers: [{ url: '/api/admin/v1' }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer' },
    },
    schemas: {
      Product: {
        type: 'object',
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
      Plan: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          description: { type: 'string' },
          rateLimit: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      User: {
        type: 'object',
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
    },
  },
  paths: {
    '/setup': {
      get: {
        summary: 'Safe setup summary',
        operationId: 'getSetup',
        responses: { '200': { description: 'Configuration presence and scope catalog' }, '401': errorResponse, '403': errorResponse },
      },
    },
    '/products': {
      get: {
        summary: 'List API products',
        operationId: 'listProducts',
        responses: {
          '200': {
            description: 'Product list',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Product' } } } },
          },
          '401': errorResponse,
          '403': errorResponse,
        },
      },
    },
    '/plans': {
      get: {
        summary: 'List rate-limit plans',
        operationId: 'listPlans',
        responses: {
          '200': {
            description: 'Plan list',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Plan' } } } },
          },
          '401': errorResponse,
          '403': errorResponse,
        },
      },
    },
    '/users': {
      get: {
        summary: 'List portal users',
        operationId: 'listUsers',
        responses: {
          '200': {
            description: 'User list (no password hashes or tokens)',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/User' } } } },
          },
          '401': errorResponse,
          '403': errorResponse,
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
