import { eq } from 'drizzle-orm'
import { db } from '../src/db'
import { users } from '../src/db/schema'
import { hashPassword } from '../src/lib/password'

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) throw new Error('ADMIN_EMAIL / ADMIN_PASSWORD belum diset')

  const values = {
    email: email.toLowerCase(),
    name: 'Portal Admin',
    passwordHash: await hashPassword(password),
    type: 'internal' as const,
    status: 'active' as const,
    role: 'portal-admin' as const,
    emailVerifiedAt: new Date(),
  }
  const existing = await db.query.users.findFirst({ where: eq(users.email, values.email) })
  if (existing) {
    await db.update(users).set(values).where(eq(users.id, existing.id))
    console.log(`updated admin ${values.email}`)
  } else {
    await db.insert(users).values(values)
    console.log(`created admin ${values.email}`)
  }
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
