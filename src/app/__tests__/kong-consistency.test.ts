import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

function actionBody(path: string, name: string) {
  const text = source(path)
  const start = text.indexOf(`export async function ${name}`)
  const next = text.indexOf('\nexport async function ', start + 1)
  if (start < 0) throw new Error(`${name} not found in ${path}`)
  return text.slice(start, next < 0 ? text.length : next)
}

describe('Kong destructive action consistency', () => {
  const actions = [
    ['src/actions/apps.ts', 'createApp'],
    ['src/actions/apps.ts', 'deleteApp'],
    ['src/actions/apps.ts', 'revokeCredential'],
    ['src/actions/admin-consumers.ts', 'adminRevokeCredential'],
    ['src/actions/admin-consumers.ts', 'adminDeleteApp'],
    ['src/actions/subscriptions.ts', 'revokeSubscription'],
  ] as const

  it.each(actions)('%s:%s does not swallow Kong failures', (path, name) => {
    expect(actionBody(path, name)).not.toContain('.catch(() => {})')
  })

  it('preflights every product service before revoking access', () => {
    const body = actionBody('src/actions/subscriptions.ts', 'revokeSubscription')
    expect(body.indexOf('await Promise.all')).toBeGreaterThan(-1)
    expect(body.indexOf('await Promise.all')).toBeLessThan(body.indexOf('removeAclGroup'))
    expect(body.indexOf('findConsumerRateLimits')).toBeLessThan(body.indexOf('removeAclGroup'))
  })

  it('compensates both credential types when persistence fails', () => {
    const body = actionBody('src/actions/apps.ts', 'createCredential')
    expect(body).toContain('await kong.deleteKeyAuth(app.kongConsumerId, cred.id)')
    expect(body).toContain('await kong.deleteJwtCred(app.kongConsumerId, cred.id)')
  })
})
