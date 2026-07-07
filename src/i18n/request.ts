import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'

export const LOCALES = ['en', 'id'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'en'

// i18n tanpa routing: locale dari cookie, default English.
export default getRequestConfig(async () => {
  const cookie = (await cookies()).get('locale')?.value
  const locale: Locale = LOCALES.includes(cookie as Locale) ? (cookie as Locale) : DEFAULT_LOCALE
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
