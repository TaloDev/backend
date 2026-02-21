import { EntityManager } from '@mikro-orm/mysql'
import { Next } from 'koa'
import APIKey from '../../../entities/api-key'
import { sign } from '../../../lib/auth/jwt'
import { ProtectedRouteContext } from '../../../lib/routing/context'
import { GameRouteState } from '../../../middleware/game-middleware'

type APIKeyRouteContext = ProtectedRouteContext<GameRouteState & { apiKey: APIKey }>

export async function loadAPIKey(ctx: APIKeyRouteContext, next: Next) {
  const { id } = ctx.params as { id: string }
  const em = ctx.em

  const apiKey = await em.repo(APIKey).findOne({
    id: Number(id),
    game: ctx.state.game,
  })

  if (!apiKey) {
    return ctx.throw(404, 'API key not found')
  }

  ctx.state.apiKey = apiKey
  await next()
}

export async function createToken(em: EntityManager, apiKey: APIKey): Promise<string> {
  await em.populate(apiKey, ['game.apiSecret'])

  const payload = {
    sub: apiKey.id,
    api: true,
    iat: Math.floor(new Date(apiKey.createdAt).getTime() / 1000),
  }

  const token = await sign(payload, apiKey.game.apiSecret.getPlainSecret()!)
  return token
}
