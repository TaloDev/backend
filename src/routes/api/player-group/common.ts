import { Next } from 'koa'
import PlayerGroup from '../../../entities/player-group.js'
import { APIRouteContext } from '../../../lib/routing/context.js'
import { APIRouteState } from '../../../lib/routing/state.js'

type PlayerGroupRouteState = APIRouteState & {
  group: PlayerGroup
}

export async function loadGroup(ctx: APIRouteContext<PlayerGroupRouteState>, next: Next) {
  const { id } = ctx.params

  const group = await ctx.em.repo(PlayerGroup).findOne({
    id,
    game: ctx.state.game,
  })

  if (!group) {
    return ctx.throw(404, 'Group not found')
  }

  ctx.state.group = group
  await next()
}
