import nodemailer from 'nodemailer'
import { getAppName } from '@/lib/site-content'
import { getTranslations } from 'next-intl/server'

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
  const [t, brand] = await Promise.all([getTranslations('mailer'), getAppName()])
  await send(to, t('verifySubject', { brand }), t('verifyBody', { url }), 'verification link')
}

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  const [t, brand] = await Promise.all([getTranslations('mailer'), getAppName()])
  await send(to, t('resetSubject', { brand }), t('resetBody', { url }), 'password reset link')
}

export async function sendInviteEmail(to: string, url: string): Promise<void> {
  const [t, brand] = await Promise.all([getTranslations('mailer'), getAppName()])
  await send(to, t('inviteSubject', { brand }), t('inviteBody', { brand, url }), 'invite link')
}
