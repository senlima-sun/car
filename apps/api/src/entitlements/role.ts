import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { user } from '../db/schema/index.ts'

export type UserRole = 'user' | 'admin'

function auditLog(event: string, fields: Record<string, unknown>) {
  console.log(JSON.stringify({ event, timestamp: new Date().toISOString(), ...fields }))
}

export async function resolveRole(db: Db, userId: string): Promise<UserRole> {
  const row = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).get()
  if (!row || (row.role !== 'user' && row.role !== 'admin')) {
    auditLog('entitlement.role.fallback', { userId })
    return 'user'
  }
  return row.role
}
