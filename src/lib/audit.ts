import { db } from '@/db'
import { auditLogs } from '@/db/schema'

export async function audit(
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  payload?: unknown,
) {
  await db.insert(auditLogs).values({
    actorUserId, action, entityType,
    entityId: entityId ?? null,
    payload: payload ?? null,
  })
}
