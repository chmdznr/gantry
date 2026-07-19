import {
  pgTable, pgEnum, uuid, text, timestamp, jsonb, uniqueIndex, integer,
} from 'drizzle-orm/pg-core'

export const userType = pgEnum('user_type', ['internal', 'external'])
export const userStatus = pgEnum('user_status', ['pending', 'active', 'suspended'])
export const userRole = pgEnum('user_role', ['developer', 'portal-admin'])
export const productStatus = pgEnum('product_status', ['draft', 'published', 'deprecated', 'retired'])
export const subscriptionStatus = pgEnum('subscription_status', ['requested', 'approved', 'rejected', 'revoked'])
export const credentialType = pgEnum('credential_type', ['key-auth', 'jwt'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  organization: text('organization'),
  type: userType('type').notNull().default('external'),
  status: userStatus('status').notNull().default('pending'),
  role: userRole('role').notNull().default('developer'),
  sessionVersion: integer('session_version').notNull().default(0),
  emailVerifiedAt: timestamp('email_verified_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  token: text('token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
})

export const passwordResetTokens = pgTable('password_reset_tokens', {
  token: text('token').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
})

export const apiProducts = pgTable('api_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  openapiSpec: jsonb('openapi_spec'),
  version: text('version').notNull().default('1.0.0'),
  kongServiceNames: text('kong_service_names').array().notNull().default([]),
  aclGroup: text('acl_group').notNull(),
  proxyBaseUrl: text('proxy_base_url').notNull(),
  status: productStatus('status').notNull().default('draft'),
  tags: text('tags').array().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  // { second?: number, minute?: number, hour?: number, day?: number }
  rateLimit: jsonb('rate_limit').notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  kongConsumerUsername: text('kong_consumer_username').notNull().unique(),
  kongConsumerId: text('kong_consumer_id'),
  blockedAt: timestamp('blocked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  apiProductId: uuid('api_product_id').notNull().references(() => apiProducts.id),
  planId: uuid('plan_id').notNull().references(() => plans.id),
  status: subscriptionStatus('status').notNull().default('requested'),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  decidedBy: uuid('decided_by').references(() => users.id),
  decidedAt: timestamp('decided_at'),
}, (t) => [uniqueIndex('uq_subscriptions_app_product').on(t.applicationId, t.apiProductId)])

export const appCredentials = pgTable('app_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  applicationId: uuid('application_id').notNull().references(() => applications.id, { onDelete: 'cascade' }),
  type: credentialType('type').notNull(),
  kongCredentialId: text('kong_credential_id').notNull(),
  hint: text('hint').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const apiProductSpecVersions = pgTable('api_product_spec_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  apiProductId: uuid('api_product_id').notNull().references(() => apiProducts.id, { onDelete: 'cascade' }),
  version: text('version').notNull(),
  spec: jsonb('spec'),
  // { added: string[], removed: string[], changed: string[] }
  changelog: jsonb('changelog'),
  note: text('note'),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const portalSettings = pgTable('portal_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
