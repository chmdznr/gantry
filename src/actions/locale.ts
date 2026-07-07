'use server'

import { cookies } from 'next/headers'
import { LOCALES, type Locale } from '@/i18n/request'

export async function setLocale(locale: string): Promise<void> {
  if (!LOCALES.includes(locale as Locale)) return
  const jar = await cookies()
  jar.set('locale', locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
}
