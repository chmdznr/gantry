'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { applications, apiProducts, plans, subscriptions } from '@/db/schema'
import { requireAdmin, requireUser } from '@/lib/require-admin'
import { audit } from '@/lib/audit'
import * as kong from '@/lib/kong'

export type ActionState = { error?: string; ok?: string }

export async function requestSubscription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireUser()
  const appId = String(formData.get('appId') ?? '')
  const productId = String(formData.get('productId') ?? '')
  const planId = String(formData.get('planId') ?? '')

  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, appId), eq(applications.ownerUserId, session.user.id)),
  })
  if (!app) return { error: 'Application tidak valid.' }
  const product = await db.query.apiProducts.findFirst({
    where: and(eq(apiProducts.id, productId), eq(apiProducts.status, 'published')),
  })
  if (!product) return { error: 'API tidak tersedia.' }
  const plan = await db.query.plans.findFirst({ where: eq(plans.id, planId) })
  if (!plan) return { error: 'Plan tidak valid.' }

  try {
    await db.insert(subscriptions).values({ applicationId: appId, apiProductId: productId, planId })
  } catch (err) {
    const code = (err as { code?: string })?.code ?? ((err as Error)?.cause as { code?: string })?.code
    if (code === '23505') return { error: 'Application ini sudah punya subscription untuk API tersebut.' }
    throw err
  }
  await audit(session.user.id, 'subscription.request', 'subscription', undefined, { appId, productId, planId })
  revalidatePath(`/apis/${product.slug}`)
  return { ok: 'Subscription diajukan — menunggu persetujuan admin.' }
}

async function loadFull(subscriptionId: string) {
  const sub = await db.query.subscriptions.findFirst({ where: eq(subscriptions.id, subscriptionId) })
  if (!sub) throw new Error('Subscription tidak ditemukan')
  const [app, product, plan] = await Promise.all([
    db.query.applications.findFirst({ where: eq(applications.id, sub.applicationId) }),
    db.query.apiProducts.findFirst({ where: eq(apiProducts.id, sub.apiProductId) }),
    db.query.plans.findFirst({ where: eq(plans.id, sub.planId) }),
  ])
  if (!app?.kongConsumerId || !product || !plan) throw new Error('Data subscription tidak lengkap')
  return { sub, app: { ...app, kongConsumerId: app.kongConsumerId }, product, plan }
}

export async function approveSubscription(subscriptionId: string): Promise<void> {
  const session = await requireAdmin()
  const { sub, app, product, plan } = await loadFull(subscriptionId)
  if (sub.status !== 'requested') return

  // tulis ke Kong dulu; rollback best-effort kalau gagal di tengah
  const createdPlugins: string[] = []
  let aclAdded = false
  try {
    await kong.addAclGroup(app.kongConsumerId, product.aclGroup)
    aclAdded = true
    for (const svc of product.kongServiceNames) {
      const p = await kong.createConsumerRateLimit(svc, app.kongConsumerId, plan.rateLimit as kong.RateLimit)
      createdPlugins.push(p.id)
    }
  } catch (err) {
    for (const id of createdPlugins) await kong.deletePlugin(id).catch(() => {})
    if (aclAdded) await kong.removeAclGroup(app.kongConsumerId, product.aclGroup).catch(() => {})
    console.error('[subscriptions] approve failed:', err)
    throw new Error('Gagal menerapkan ke Kong — subscription tetap requested.')
  }

  await db.update(subscriptions)
    .set({ status: 'approved', decidedBy: session.user.id, decidedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))
  await audit(session.user.id, 'subscription.approve', 'subscription', subscriptionId, {
    app: app.name, product: product.slug, plan: plan.name,
  })
  revalidatePath('/admin/subscriptions')
}

export async function rejectSubscription(subscriptionId: string): Promise<void> {
  const session = await requireAdmin()
  await db.update(subscriptions)
    .set({ status: 'rejected', decidedBy: session.user.id, decidedAt: new Date() })
    .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.status, 'requested')))
  await audit(session.user.id, 'subscription.reject', 'subscription', subscriptionId)
  revalidatePath('/admin/subscriptions')
}

export async function revokeSubscription(subscriptionId: string): Promise<void> {
  const session = await requireAdmin()
  const { sub, app, product } = await loadFull(subscriptionId)
  if (sub.status !== 'approved') return

  await kong.removeAclGroup(app.kongConsumerId, product.aclGroup).catch(() => {})
  // hapus hanya rate-limit milik service produk ini (app bisa punya subscription lain)
  const serviceIds = new Set<string>()
  for (const svc of product.kongServiceNames) {
    const sid = await kong.getServiceId(svc).catch(() => null)
    if (sid) serviceIds.add(sid)
  }
  const rls = await kong.findConsumerRateLimits(app.kongConsumerId)
  for (const p of rls) {
    if (p.service?.id && serviceIds.has(p.service.id)) await kong.deletePlugin(p.id).catch(() => {})
  }

  await db.update(subscriptions)
    .set({ status: 'revoked', decidedBy: session.user.id, decidedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))
  await audit(session.user.id, 'subscription.revoke', 'subscription', subscriptionId, {
    app: app.name, product: product.slug,
  })
  revalidatePath('/admin/subscriptions')
}
