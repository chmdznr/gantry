// Branding generik — override via env untuk deployment ber-merek.
export const BRAND = {
  name: process.env.NEXT_PUBLIC_PORTAL_NAME ?? 'Gantry',
  tagline: process.env.NEXT_PUBLIC_PORTAL_TAGLINE ?? 'Developer portal for Kong Gateway',
}
