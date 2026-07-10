'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { portalSettings } from '@/db/schema'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'
import { CONTENT_FIELDS, CONTENT_LOCALES, contentKey } from '@/lib/site-content'

export async function updateSiteContent(formData: FormData) {
  const session = await requireAdmin()
  const keys: string[] = []
  for (const f of CONTENT_FIELDS) {
    if (f.perLocale) for (const loc of CONTENT_LOCALES) keys.push(contentKey(f.base, loc))
    else keys.push(contentKey(f.base))
  }
  for (const key of keys) {
    const raw = String(formData.get(key) ?? '').trim()
    if (raw.length === 0) {
      await db.delete(portalSettings).where(eq(portalSettings.key, key)) // revert to default
    } else {
      await db.insert(portalSettings).values({ key, value: raw })
        .onConflictDoUpdate({ target: portalSettings.key, set: { value: raw } })
    }
  }
  await audit(session.user.id, 'settings.content.update', 'portal_settings', 'content', {})
  revalidatePath('/', 'layout')
}
