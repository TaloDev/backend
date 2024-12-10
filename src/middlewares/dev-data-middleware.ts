import { QBFilterQuery, EntityManager } from '@mikro-orm/mysql'
import { Context, Next } from 'koa'
import Player from '../entities/player'
import PlayerProp from '../entities/player-prop'

export default async function devDataMiddleware(ctx: Context, next: Next): Promise<void> {
  if (Number(ctx.headers['x-talo-include-dev-data'])) {
    ctx.state.includeDevData = true
  }

  await next()
}

export function devDataPlayerFilter(em: EntityManager): QBFilterQuery<Player> {
  return {
    $nin: em.qb(PlayerProp).select('player_id', true).where({
      key: 'META_DEV_BUILD'
    }).getKnexQuery()
  }
}
