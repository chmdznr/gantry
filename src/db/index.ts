import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

function createDatabase() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  return drizzle(postgres(url), { schema })
}

type Database = ReturnType<typeof createDatabase>
let database: Database | undefined

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const current = database ??= createDatabase()
    const value = Reflect.get(current, property, current)
    return typeof value === 'function' ? value.bind(current) : value
  },
})
