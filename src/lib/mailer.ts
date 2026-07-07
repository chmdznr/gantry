import nodemailer from 'nodemailer'
import { BRAND } from '@/lib/brand'

async function send(to: string, subject: string, text: string, logLabel: string): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.log(`[mailer] ${logLabel} for ${to}: ${text.match(/https?:\S+/)?.[0] ?? text}`)
    return
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    // auth opsional: relay internal tanpa auth juga didukung
    ...(process.env.SMTP_USER ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS! } } : {}),
  })
  await transport.sendMail({ from: process.env.SMTP_FROM ?? 'devportal@kai.id', to, subject, text })
}

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  await send(to, `Verifikasi email — ${BRAND.name}`,
    `Klik untuk verifikasi email Anda: ${url}\nLink berlaku 24 jam.`, 'verification link')
}

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  await send(to, `Reset password — ${BRAND.name}`,
    `Klik untuk mengatur ulang password Anda: ${url}\nLink berlaku 1 jam. Abaikan email ini jika Anda tidak meminta reset.`, 'password reset link')
}
