import localFont from 'next/font/local'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

// Display: Clash Display (self-hosted variable woff2, CSP-safe — no CDN fetch).
export const displayFont = localFont({
  src: './fonts/ClashDisplay-Variable.woff2',
  variable: '--font-display',
  weight: '400 700',
  display: 'swap',
})

// Body + mono: Geist (self-hosted by the `geist` package).
export const sansFont = GeistSans // exposes --font-geist-sans via .variable
export const monoFont = GeistMono // exposes --font-geist-mono via .variable
