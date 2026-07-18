'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { applications, apiProducts, plans, subscriptions } from '@/db/schema'
import { requireAdmin, requireUser } from '@/lib/require-admin'
import { audit } from '@/lib/audit'
import { isUniqueViolation } from '@/lib/db-errors'
import * as kong from '@/lib/kong'
import { getTranslations } from 'next-intl/server'

export type ActionState = { error?: string; ok?: string }

export async function requestSubscription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations('actions')
  const session = await requireUser()
  const appId = String(formData.get('appId') ?? '')
  const productId = String(formData.get('productId') ?? '')
  const planId = String(formData.get('planId') ?? '')

  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, appId), eq(applications.ownerUserId, session.user.id)),
  })
  if (!app) return { error: t('appInvalid') }
  const product = await db.query.apiProducts.findFirst({
    where: and(eq(apiProducts.id, productId), eq(apiProducts.status, 'published')),
  })
  if (!product) return { error: t('apiUnavailable') }
  const plan = await db.query.plans.findFirst({ where: eq(plans.id, planId) })
  if (!plan) return { error: t('planInvalid') }

  // re-subscribe: baris rejected/revoked dipakai ulang, bukan insert baru (unique app+product)
  const prior = await db.query.subscriptions.findFirst({
    where: and(eq(subscriptions.applicationId, appId), eq(subscriptions.apiProductId, productId)),
  })
  if (prior && (prior.status === 'requested' || prior.status === 'approved')) {
    return { error: t('alreadySubscribed') }
  }
  try {
    if (prior) {
      await db.update(subscriptions).set({
        planId, status: 'requested', requestedAt: new Date(), decidedBy: null, decidedAt: null,
      }).where(eq(subscriptions.id, prior.id))
    } else {
      await db.insert(subscriptions).values({ applicationId: appId, apiProductId: productId, planId })
    }
  } catch (err) {
    if (isUniqueViolation(err)) return { error: t('duplicateSubscription') }
    throw err
  }
  await audit(session.user.id, 'subscription.request', 'subscription', undefined, { appId, productId, planId })
  revalidatePath(`/apis/${product.slug}`)
  return { ok: t('subscribeOk') }
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

// error operasional (Kong down, service hilang) bukan crash: tampilkan sebagai pesan
// di /admin/subscriptions lewat query param, jangan lempar ke error boundary generik.
function failApprove(message: string): never {
  redirect(`/admin/subscriptions?error=${encodeURIComponent(message)}`)
}

export async function approveSubscription(subscriptionId: string): Promise<void> {
  const session = await requireAdmin()
  const { sub, app, product, plan } = await loadFull(subscriptionId).catch((err: Error) => failApprove(err.message))
  if (sub.status !== 'requested') return

  // pre-validasi supaya pesannya presisi sebelum menyentuh Kong
  for (const svc of product.kongServiceNames) {
    if (!(await kong.getServiceId(svc).catch(() => null))) {
      failApprove(`Kong service "${svc}" not found. Fix the Kong service names of "${product.name}" in Admin › APIs.`)
    }
  }

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
    const detail = err instanceof kong.KongError ? ` (${err.message}: ${err.body.slice(0, 120)})` : ''
    failApprove(`Failed to apply changes on Kong — the subscription stays requested.${detail}`)
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

  const serviceIds = new Set(await Promise.all(product.kongServiceNames.map(kong.getServiceId)))
  const rateLimits = await kong.findConsumerRateLimits(app.kongConsumerId)

  await kong.removeAclGroup(app.kongConsumerId, product.aclGroup)
  for (const plugin of rateLimits) {
    if (plugin.service?.id && serviceIds.has(plugin.service.id)) {
      await kong.deletePlugin(plugin.id)
    }
  }

  await db.update(subscriptions)
    .set({ status: 'revoked', decidedBy: session.user.id, decidedAt: new Date() })
    .where(eq(subscriptions.id, subscriptionId))
  await audit(session.user.id, 'subscription.revoke', 'subscription', subscriptionId, {
    app: app.name, product: product.slug,
  })
  revalidatePath('/admin/subscriptions')
}
