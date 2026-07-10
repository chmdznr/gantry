'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { portalSettings } from '@/db/schema'
import { audit } from '@/lib/audit'
import { requireAdmin } from '@/lib/require-admin'
import { isMode, isThemeKey } from '@/lib/themes'

export async function updateTheme(formData: FormData) {
  const session = await requireAdmin()
  const theme = String(formData.get('theme') ?? '')
  if (!isThemeKey(theme)) throw new Error('Invalid theme')
  await db.insert(portalSettings).values({ key: 'theme', value: theme })
    .onConflictDoUpdate({ target: portalSettings.key, set: { value: theme } })
  await audit(session.user.id, 'settings.theme.update', 'portal_settings', 'theme', { theme })
  revalidatePath('/', 'layout')
}

export async function updateMode(formData: FormData) {
  const session = await requireAdmin()
  const mode = String(formData.get('mode') ?? '')
  if (!isMode(mode)) throw new Error('Invalid mode')
  await db.insert(portalSettings).values({ key: 'mode', value: mode })
    .onConflictDoUpdate({ target: portalSettings.key, set: { value: mode } })
  await audit(session.user.id, 'settings.mode.update', 'portal_settings', 'mode', { mode })
  revalidatePath('/', 'layout')
}
