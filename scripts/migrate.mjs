// Jalankan migrasi drizzle saat container start (sebelum server.js).
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set')
const sql = postgres(process.env.DATABASE_URL, { max: 1 })
await migrate(drizzle(sql), { migrationsFolder: './drizzle' })
await sql.end()
console.log('[migrate] migrations applied')
