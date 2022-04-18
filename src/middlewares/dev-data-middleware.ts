import { expr, ObjectQuery } from '@mikro-orm/core'
import { Context, Next } from 'koa'
import Player from '../entities/player'

export default async (ctx: Context, next: Next): Promise<void> => {
  if (Number(ctx.headers['x-talo-include-dev-data'])) {
    ctx.state.includeDevData = true
  }

  await next()
}

export const devDataPlayerFilter: ObjectQuery<Player> = {
  [expr((alias) => `json_search(${alias}.props, 'one', 'META_DEV_BUILD', null, '$[*].key')`)]: null
}
