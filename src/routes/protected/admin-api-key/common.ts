import { Next } from 'koa'
import crypto from 'node:crypto'
import AdminAPIKey from '../../../entities/admin-api-key.js'
import { ProtectedRouteContext } from '../../../lib/routing/context.js'
import { GameRouteState } from '../../../middleware/game-middleware.js'

type AdminAPIKeyRouteContext = ProtectedRouteContext<GameRouteState & { adminAPIKey: AdminAPIKey }>

export async function loadAdminAPIKey(ctx: AdminAPIKeyRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const apiKey = await em.repo(AdminAPIKey).findOne({ id: Number(id), game: ctx.state.game })
  if (!apiKey) {
    return ctx.throw(404, 'Admin API key not found')
  }

  ctx.state.adminAPIKey = apiKey
  await next()
}

export function generateAdminAPIKey() {
  const key = `ta_${crypto.randomBytes(32).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(key).digest('hex')
  const keyEnding = key.slice(-4)
  return { key, keyHash, keyEnding }
}
