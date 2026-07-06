import nodemailer from 'nodemailer'

export async function sendVerificationEmail(to: string, url: string): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.log(`[mailer] verification link for ${to}: ${url}`)
    return
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS! },
  })
  await transport.sendMail({
    from: process.env.SMTP_FROM ?? 'devportal@kai.id',
    to,
    subject: 'Verifikasi email — KAI API Developer Portal',
    text: `Klik untuk verifikasi email Anda: ${url}\nLink berlaku 24 jam.`,
  })
}
