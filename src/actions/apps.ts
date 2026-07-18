'use server'

import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { applications, appCredentials } from '@/db/schema'
import { requireUser } from '@/lib/require-admin'
import { audit } from '@/lib/audit'
import * as kong from '@/lib/kong'
import { getTranslations } from 'next-intl/server'

export type ActionState = { error?: string }
export type SecretState = { error?: string; secret?: { type: 'key-auth' | 'jwt'; key: string; jwtSecret?: string } }

async function ownedApp(appId: string, userId: string) {
  const app = await db.query.applications.findFirst({
    where: and(eq(applications.id, appId), eq(applications.ownerUserId, userId)),
  })
  if (!app) throw new Error('Application tidak ditemukan')
  return app
}

export async function createApp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await getTranslations('actions')
  const session = await requireUser()
  const name = String(formData.get('name') ?? '').trim()
  const description = String(formData.get('description') ?? '').trim()
  if (name.length < 3) return { error: t('appNameMin') }

  const id = randomUUID()
  const username = `app-${id}`
  let consumer: { id: string }
  try {
    consumer = await kong.createConsumer(username)
  } catch (err) {
    console.error('[apps] createConsumer failed:', err)
    return { error: t('kongConsumerFailed') }
  }
  try {
    await db.insert(applications).values({
      id, name, description,
      ownerUserId: session.user.id,
      kongConsumerUsername: username,
      kongConsumerId: consumer.id,
    })
  } catch (err) {
    await kong.deleteConsumer(consumer.id)
    console.error('[apps] insert failed:', err)
    return { error: t('appSaveFailed') }
  }
  await audit(session.user.id, 'app.create', 'application', id, { name })
  revalidatePath('/apps')
  return {}
}

export async function deleteApp(appId: string): Promise<void> {
  const session = await requireUser()
  const app = await ownedApp(appId, session.user.id)
  if (app.kongConsumerId) await kong.deleteConsumer(app.kongConsumerId)
  await db.delete(applications).where(eq(applications.id, appId))
  await audit(session.user.id, 'app.delete', 'application', appId, { name: app.name })
  revalidatePath('/apps')
}

export async function createCredential(_prev: SecretState, formData: FormData): Promise<SecretState> {
  const t = await getTranslations('actions')
  const session = await requireUser()
  const appId = String(formData.get('appId') ?? '')
  const type = String(formData.get('type') ?? '')
  if (type !== 'key-auth' && type !== 'jwt') return { error: t('credTypeInvalid') }
  const app = await ownedApp(appId, session.user.id)
  if (!app.kongConsumerId) return { error: t('consumerMissing') }

  try {
    if (type === 'key-auth') {
      const cred = await kong.createKeyAuth(app.kongConsumerId)
      try {
        await db.insert(appCredentials).values({
          applicationId: appId, type, kongCredentialId: cred.id, hint: cred.key.slice(-4),
        })
      } catch (err) {
        try {
          await kong.deleteKeyAuth(app.kongConsumerId, cred.id)
        } catch (cleanupErr) {
          throw new AggregateError([err, cleanupErr], 'Credential persistence and compensation failed')
        }
        throw err
      }
      await audit(session.user.id, 'credential.create', 'app_credential', cred.id, { appId, type })
      revalidatePath(`/apps/${appId}`)
      return { secret: { type, key: cred.key } }
    }
    const cred = await kong.createJwtCred(app.kongConsumerId)
    try {
      await db.insert(appCredentials).values({
        applicationId: appId, type, kongCredentialId: cred.id, hint: cred.key.slice(-4),
      })
    } catch (err) {
      try {
        await kong.deleteJwtCred(app.kongConsumerId, cred.id)
      } catch (cleanupErr) {
        throw new AggregateError([err, cleanupErr], 'Credential persistence and compensation failed')
      }
      throw err
    }
    await audit(session.user.id, 'credential.create', 'app_credential', cred.id, { appId, type })
    revalidatePath(`/apps/${appId}`)
    return { secret: { type, key: cred.key, jwtSecret: cred.secret } }
  } catch (err) {
    console.error('[apps] createCredential failed:', err)
    return { error: t('credCreateFailed') }
  }
}

export async function revokeCredential(appId: string, credentialId: string): Promise<void> {
  const session = await requireUser()
  const app = await ownedApp(appId, session.user.id)
  const cred = await db.query.appCredentials.findFirst({
    where: and(eq(appCredentials.id, credentialId), eq(appCredentials.applicationId, appId)),
  })
  if (!cred || !app.kongConsumerId) return
  if (cred.type === 'key-auth') await kong.deleteKeyAuth(app.kongConsumerId, cred.kongCredentialId)
  else await kong.deleteJwtCred(app.kongConsumerId, cred.kongCredentialId)
  await db.delete(appCredentials).where(eq(appCredentials.id, credentialId))
  await audit(session.user.id, 'credential.revoke', 'app_credential', cred.kongCredentialId, { appId, type: cred.type })
  revalidatePath(`/apps/${appId}`)
}
