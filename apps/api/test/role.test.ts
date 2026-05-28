import { describe, expect, test, vi } from 'vitest'
import { user } from '../src/db/schema/index.ts'
import { resolveRole } from '../src/entitlements/role.ts'
import { memoryHarness } from './helpers/memory-env.ts'

async function seedUser(
  db: ReturnType<typeof memoryHarness>['db'],
  id: string,
  role: 'user' | 'admin',
): Promise<void> {
  const now = new Date()
  await db
    .insert(user)
    .values({ id, name: id, email: `${id}@example.com`, role, createdAt: now, updatedAt: now })
    .run()
}

describe('resolveRole', () => {
  test('returns user role for a normal user row', async () => {
    const { db } = memoryHarness()
    await seedUser(db, 'u1', 'user')

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const role = await resolveRole(db, 'u1')
    expect(role).toBe('user')
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  test('returns admin role for an admin user row', async () => {
    const { db } = memoryHarness()
    await seedUser(db, 'admin1', 'admin')

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const role = await resolveRole(db, 'admin1')
    expect(role).toBe('admin')
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  test('falls back to user and emits audit log when userId is not in DB', async () => {
    const { db } = memoryHarness()

    const logs: string[] = []
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      logs.push(msg)
    })

    const role = await resolveRole(db, 'ghost-user')
    expect(role).toBe('user')
    expect(logs).toHaveLength(1)
    const event = JSON.parse(logs[0])
    expect(event.event).toBe('entitlement.role.fallback')
    expect(event.userId).toBe('ghost-user')
    consoleSpy.mockRestore()
  })
})
