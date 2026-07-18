'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { appCredentials, applications } from '@/db/schema'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'
import * as kong from '@/lib/kong'

async function loadApp(appId: string) {
  const app = await db.query.applications.findFirst({ where: eq(applications.id, appId) })
  if (!app?.kongConsumerId) throw new Error('Application tidak ditemukan')
  return app
}

export async function blockApp(appId: string): Promise<void> {
  const session = await requireAdmin()
  const app = await loadApp(appId)
  if (app.blockedAt) return
  await kong.blockConsumer(app.kongConsumerId!) // Kong dulu, baru DB
  await db.update(applications).set({ blockedAt: new Date() }).where(eq(applications.id, appId))
  await audit(session.user.id, 'app.block', 'application', appId, { name: app.name })
  revalidatePath('/admin/consumers')
}

export async function unblockApp(appId: string): Promise<void> {
  const session = await requireAdmin()
  const app = await loadApp(appId)
  await kong.unblockConsumer(app.kongConsumerId!)
  await db.update(applications).set({ blockedAt: null }).where(eq(applications.id, appId))
  await audit(session.user.id, 'app.unblock', 'application', appId, { name: app.name })
  revalidatePath('/admin/consumers')
}

export async function adminRevokeCredential(appId: string, credentialId: string): Promise<void> {
  const session = await requireAdmin()
  const app = await loadApp(appId)
  const cred = await db.query.appCredentials.findFirst({
    where: and(eq(appCredentials.id, credentialId), eq(appCredentials.applicationId, appId)),
  })
  if (!cred) return
  if (cred.type === 'key-auth') await kong.deleteKeyAuth(app.kongConsumerId!, cred.kongCredentialId)
  else await kong.deleteJwtCred(app.kongConsumerId!, cred.kongCredentialId)
  await db.delete(appCredentials).where(eq(appCredentials.id, credentialId))
  await audit(session.user.id, 'credential.revoke.admin', 'app_credential', cred.kongCredentialId, {
    appId, type: cred.type,
  })
  revalidatePath('/admin/consumers')
  revalidatePath(`/apps/${appId}`)
}

export async function adminDeleteApp(appId: string): Promise<void> {
  const session = await requireAdmin()
  const app = await loadApp(appId)
  await kong.deleteConsumer(app.kongConsumerId!)
  await db.delete(applications).where(eq(applications.id, appId))
  await audit(session.user.id, 'app.delete.admin', 'application', appId, { name: app.name })
  revalidatePath('/admin/consumers')
}
